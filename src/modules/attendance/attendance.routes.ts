import { Router } from 'express';
import { z } from 'zod';
import { oid, requireRole, tenant } from '../../core/auth';
import { badRequest, notFound } from '../../core/errors';
import { events } from '../../core/events';
import { created, ok, sendCsv } from '../../core/http';
import { ACADEMIC_STAFF, EMPLOYEES, EVERYONE, LEARNERS, MANAGEMENT } from '../../core/roles';
import { assertOwned } from '../../core/tenancy';
import { dayOfWeek, todayIn } from '../../core/utils';
import { dateString, idParam, objectId, params, query, timeString, validate } from '../../core/validate';
import { Batch, Subject } from '../academics/academics.models';
import { assertCanManageBatch } from '../academics/batch-access';
import { getCurrentSession } from '../institutions/academic-session.model';
import { getInstitutionSettings } from '../institutions/institution.service';
import { Student } from '../people/people.models';
import { assertCanViewStudent } from '../people/student-access';
import { ATTENDANCE_STATUSES, AttendanceSheet, Holiday } from './attendance.models';
import { attendanceStats, statsFor } from './attendance.service';

const router = Router();

const period = z.union([z.literal('day'), timeString]).default('day');
const monthString = z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM');

const holidayOn = (institutionId: string, date: string, batchId?: string) =>
  Holiday.findOne({
    institutionId,
    date,
    $or: [{ batchIds: { $size: 0 } }, ...(batchId ? [{ batchIds: batchId }] : [])],
  }).lean();

/**
 * The register for a batch on a date: every active student with their
 * current status (null if not marked yet). This is what the teacher app shows.
 */
router.get(
  '/sheet',
  requireRole(...ACADEMIC_STAFF),
  validate({ query: z.object({ batchId: objectId, date: dateString.optional(), period }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const q = query<{ batchId: string; date?: string; period: string }>(req);
    await assertCanManageBatch(ctx, q.batchId);
    const institution = await getInstitutionSettings(ctx.institutionId);
    const date = q.date ?? todayIn(institution.timezone);

    const [students, sheet, holiday] = await Promise.all([
      Student.find({ institutionId: ctx.institutionId, batchId: q.batchId, status: 'active' })
        .select('name enrollmentNo rollNo photoUrl')
        .sort({ rollNo: 1, name: 1 })
        .lean(),
      AttendanceSheet.findOne({ batchId: q.batchId, date, period: q.period }).populate('takenBy', 'name').lean(),
      holidayOn(ctx.institutionId, date, q.batchId),
    ]);

    const entryMap = new Map((sheet?.entries ?? []).map((entry) => [String(entry.studentId), entry]));
    ok(res, {
      batchId: q.batchId,
      date,
      period: q.period,
      isMarked: Boolean(sheet),
      holiday,
      isWorkingDay: institution.settings.workingDays.includes(dayOfWeek(date)),
      takenBy: sheet?.takenBy ?? null,
      counts: sheet?.counts ?? null,
      students: students.map((student) => ({
        ...student,
        status: entryMap.get(String(student._id))?.status ?? null,
        remark: entryMap.get(String(student._id))?.remark ?? null,
      })),
    });
  },
);

/** Save (or correct) a register. Guardians of newly absent students get notified. */
router.put(
  '/sheet',
  requireRole(...ACADEMIC_STAFF),
  validate({
    body: z.object({
      batchId: objectId,
      date: dateString,
      period,
      subjectId: objectId.optional(),
      entries: z
        .array(z.object({ studentId: objectId, status: z.enum(ATTENDANCE_STATUSES), remark: z.string().max(200).optional() }))
        .min(1),
    }),
  }),
  async (req, res) => {
    const ctx = tenant(req);
    const body = req.body as {
      batchId: string;
      date: string;
      period: string;
      subjectId?: string;
      entries: Array<{ studentId: string; status: (typeof ATTENDANCE_STATUSES)[number]; remark?: string }>;
    };
    await assertCanManageBatch(ctx, body.batchId);
    const institution = await getInstitutionSettings(ctx.institutionId);

    if (body.date > todayIn(institution.timezone)) throw badRequest('Cannot mark attendance for a future date');
    if (institution.settings.attendanceMode === 'daily' && body.period !== 'day') {
      throw badRequest('This institution takes daily attendance; use period "day"');
    }
    if (body.subjectId) await assertOwned(Subject, ctx.institutionId, [body.subjectId], 'subjects');

    const ids = [...new Set(body.entries.map((entry) => entry.studentId))];
    if (ids.length !== body.entries.length) throw badRequest('A student appears more than once');
    const inBatch = await Student.countDocuments({ _id: { $in: ids }, institutionId: ctx.institutionId, batchId: body.batchId });
    if (inBatch !== ids.length) throw badRequest('Some students do not belong to this batch');

    const counts = { present: 0, absent: 0, late: 0, leave: 0, excused: 0 };
    for (const entry of body.entries) counts[entry.status] += 1;

    const previous = await AttendanceSheet.findOne({ batchId: body.batchId, date: body.date, period: body.period }).lean();
    const previouslyAbsent = new Set(
      (previous?.entries ?? []).filter((entry) => entry.status === 'absent').map((entry) => String(entry.studentId)),
    );

    const sheet = await AttendanceSheet.findOneAndUpdate(
      { batchId: body.batchId, date: body.date, period: body.period },
      {
        institutionId: ctx.institutionId,
        subjectId: body.subjectId,
        takenBy: ctx.userId,
        entries: body.entries,
        counts,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const newlyAbsent = body.entries
      .filter((entry) => entry.status === 'absent' && !previouslyAbsent.has(entry.studentId))
      .map((entry) => entry.studentId);
    if (newlyAbsent.length) {
      events.emit('attendance.marked', {
        institutionId: ctx.institutionId,
        batchId: body.batchId,
        date: body.date,
        absentStudentIds: newlyAbsent,
      });
    }

    ok(res, sheet, undefined, previous ? 'Attendance updated' : 'Attendance saved');
  },
);

/** Overall + month-wise (+ subject-wise) attendance of one student. */
router.get(
  '/students/:id/summary',
  requireRole(...EMPLOYEES, ...LEARNERS),
  validate({ params: idParam, query: z.object({ from: dateString.optional(), to: dateString.optional() }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const { id } = params<{ id: string }>(req);
    await assertCanViewStudent(ctx, id);
    const range = query<{ from?: string; to?: string }>(req);
    if (!range.from) {
      const session = await getCurrentSession(ctx.institutionId).catch(() => null);
      range.from = session?.startDate;
    }

    const [overall, monthly, bySubject] = await Promise.all([
      attendanceStats(ctx.institutionId, [id], range),
      attendanceStats(ctx.institutionId, [id], range, 'student_month'),
      attendanceStats(ctx.institutionId, [id], range, 'student_subject'),
    ]);

    const subjectIds = [...bySubject.keys()].map((key) => key.split('|')[1]).filter(Boolean);
    const subjects = await Subject.find({ _id: { $in: subjectIds } }).select('name').lean();
    const subjectNames = new Map(subjects.map((subject) => [String(subject._id), subject.name]));

    ok(res, {
      studentId: id,
      range,
      overall: statsFor(overall, id),
      months: [...monthly.entries()]
        .map(([key, stats]) => ({ month: key.split('|')[1], ...stats }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      subjects: [...bySubject.entries()]
        .filter(([key]) => key.includes('|'))
        .map(([key, stats]) => ({ subjectId: key.split('|')[1], subject: subjectNames.get(key.split('|')[1]) ?? null, ...stats })),
    });
  },
);

/** Day-by-day calendar for one student for a month (for the calendar view in apps). */
router.get(
  '/students/:id/calendar',
  requireRole(...EMPLOYEES, ...LEARNERS),
  validate({ params: idParam, query: z.object({ month: monthString }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const { id } = params<{ id: string }>(req);
    const student = await assertCanViewStudent(ctx, id);
    const { month } = query<{ month: string }>(req);

    const [sheets, holidays] = await Promise.all([
      AttendanceSheet.find({
        institutionId: ctx.institutionId,
        'entries.studentId': oid(id),
        date: { $gte: `${month}-01`, $lte: `${month}-31` },
      })
        .select('date period subjectId entries.$')
        .populate('subjectId', 'name')
        .lean(),
      Holiday.find({
        institutionId: ctx.institutionId,
        date: { $gte: `${month}-01`, $lte: `${month}-31` },
        $or: [{ batchIds: { $size: 0 } }, ...(student.batchId ? [{ batchIds: student.batchId }] : [])],
      })
        .select('date name type')
        .lean(),
    ]);

    const days = new Map<string, Array<{ period: string; subject?: string | null; status: string }>>();
    for (const sheet of sheets) {
      const entry = sheet.entries[0];
      if (!entry) continue;
      const list = days.get(sheet.date) ?? [];
      list.push({
        period: sheet.period,
        subject: (sheet.subjectId as unknown as { name?: string } | null)?.name ?? null,
        status: entry.status,
      });
      days.set(sheet.date, list);
    }

    ok(res, {
      month,
      holidays,
      days: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, periods]) => ({ date, periods })),
    });
  },
);

/** Batch report: every student's attendance over a range. `format=csv` downloads it. */
router.get(
  '/report',
  requireRole(...ACADEMIC_STAFF),
  validate({
    query: z.object({
      batchId: objectId,
      from: dateString.optional(),
      to: dateString.optional(),
      format: z.enum(['json', 'csv']).default('json'),
    }),
  }),
  async (req, res) => {
    const ctx = tenant(req);
    const q = query<{ batchId: string; from?: string; to?: string; format: 'json' | 'csv' }>(req);
    const batch = await assertCanManageBatch(ctx, q.batchId);
    const students = await Student.find({ institutionId: ctx.institutionId, batchId: q.batchId, status: 'active' })
      .select('name enrollmentNo rollNo')
      .sort({ rollNo: 1, name: 1 })
      .lean();
    const stats = await attendanceStats(ctx.institutionId, students.map((student) => student._id), q);
    const rows = students.map((student) => ({ ...student, ...statsFor(stats, String(student._id)) }));

    if (q.format === 'csv') {
      return sendCsv(res, `attendance-${batch.name}.csv`, [
        ['Name', 'Enrollment No', 'Roll No', 'Present', 'Late', 'Absent', 'Leave', 'Total', 'Percentage'],
        ...rows.map((row) => [row.name, row.enrollmentNo, row.rollNo, row.present, row.late, row.absent, row.leave, row.total, row.percentage]),
      ]);
    }
    return ok(res, { batch: { id: batch._id, name: batch.name }, range: { from: q.from, to: q.to }, students: rows });
  },
);

/** Students below the attendance threshold (defaults to the institution's setting). */
router.get(
  '/low',
  requireRole(...ACADEMIC_STAFF),
  validate({
    query: z.object({
      batchId: objectId.optional(),
      threshold: z.coerce.number().min(0).max(100).optional(),
      from: dateString.optional(),
      to: dateString.optional(),
    }),
  }),
  async (req, res) => {
    const ctx = tenant(req);
    const q = query<{ batchId?: string; threshold?: number; from?: string; to?: string }>(req);
    const institution = await getInstitutionSettings(ctx.institutionId);
    const threshold = q.threshold ?? institution.settings.lowAttendanceThreshold;

    let batchIds: string[];
    if (q.batchId) {
      await assertCanManageBatch(ctx, q.batchId);
      batchIds = [q.batchId];
    } else {
      if (ctx.role === 'teacher') throw badRequest('batchId is required');
      const session = await getCurrentSession(ctx.institutionId);
      batchIds = (await Batch.find({ institutionId: ctx.institutionId, sessionId: session._id, isActive: true }).select('_id').lean()).map((b) =>
        String(b._id),
      );
    }

    const students = await Student.find({ institutionId: ctx.institutionId, batchId: { $in: batchIds }, status: 'active' })
      .select('name enrollmentNo rollNo batchId')
      .populate('batchId', 'name')
      .lean();
    const stats = await attendanceStats(ctx.institutionId, students.map((student) => student._id), q);
    const low = students
      .map((student) => ({ ...student, ...statsFor(stats, String(student._id)) }))
      .filter((row) => row.total > 0 && row.percentage < threshold)
      .sort((a, b) => a.percentage - b.percentage);
    ok(res, { threshold, students: low });
  },
);

/** Which batches have marked attendance on a date, with present/absent counts. */
router.get(
  '/overview',
  requireRole(...MANAGEMENT),
  validate({ query: z.object({ date: dateString.optional() }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const institution = await getInstitutionSettings(institutionId);
    const date = query<{ date?: string }>(req).date ?? todayIn(institution.timezone);
    const session = await getCurrentSession(institutionId);

    const [batches, sheets, holiday] = await Promise.all([
      Batch.find({ institutionId, sessionId: session._id, isActive: true }).select('name programId').populate('programId', 'name level').lean(),
      AttendanceSheet.find({ institutionId, date }).select('batchId period counts').lean(),
      holidayOn(institutionId, date),
    ]);

    const byBatch = new Map<string, { present: number; absent: number; late: number; leave: number; periods: number }>();
    for (const sheet of sheets) {
      const key = String(sheet.batchId);
      const current = byBatch.get(key) ?? { present: 0, absent: 0, late: 0, leave: 0, periods: 0 };
      current.present += sheet.counts?.present ?? 0;
      current.absent += sheet.counts?.absent ?? 0;
      current.late += sheet.counts?.late ?? 0;
      current.leave += sheet.counts?.leave ?? 0;
      current.periods += 1;
      byBatch.set(key, current);
    }

    const rows = batches.map((batch) => ({ batch, marked: byBatch.has(String(batch._id)), ...(byBatch.get(String(batch._id)) ?? {}) }));
    const totals = [...byBatch.values()].reduce(
      (sum, item) => ({ present: sum.present + item.present + item.late, absent: sum.absent + item.absent + item.leave }),
      { present: 0, absent: 0 },
    );
    ok(res, {
      date,
      holiday,
      batchesMarked: rows.filter((row) => row.marked).length,
      batchesTotal: rows.length,
      ...totals,
      percentage: totals.present + totals.absent ? Math.round((totals.present / (totals.present + totals.absent)) * 1000) / 10 : 0,
      batches: rows,
    });
  },
);

// ---------------- Holidays ----------------

router.get(
  '/holidays',
  requireRole(...EVERYONE),
  validate({ query: z.object({ from: dateString.optional(), to: dateString.optional() }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const q = query<{ from?: string; to?: string }>(req);
    const date: Record<string, string> = {};
    if (q.from) date.$gte = q.from;
    if (q.to) date.$lte = q.to;
    ok(res, await Holiday.find({ institutionId, ...(Object.keys(date).length ? { date } : {}) }).sort({ date: 1 }).lean());
  },
);

router.post(
  '/holidays',
  requireRole(...MANAGEMENT),
  validate({
    body: z.object({
      date: dateString,
      toDate: dateString.optional(),
      name: z.string().trim().min(2).max(100),
      type: z.enum(['national', 'regional', 'institution', 'exam', 'vacation']).optional(),
      batchIds: z.array(objectId).optional(),
    }),
  }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const { date, toDate, ...rest } = req.body as { date: string; toDate?: string; batchIds?: string[] } & Record<string, unknown>;
    await assertOwned(Batch, institutionId, rest.batchIds ?? [], 'batches');

    // A date range (e.g. summer vacation) creates one entry per day.
    const dates: string[] = [];
    const end = toDate ?? date;
    if (end < date) throw badRequest('toDate must be on or after date');
    for (let day = new Date(`${date}T00:00:00Z`); day <= new Date(`${end}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) {
      dates.push(day.toISOString().slice(0, 10));
      if (dates.length > 120) throw badRequest('Holiday range cannot exceed 120 days');
    }

    for (const day of dates) {
      await Holiday.updateOne(
        { institutionId, date: day, name: rest.name },
        { $set: { ...rest, institutionId, date: day } },
        { upsert: true },
      );
    }
    created(res, await Holiday.find({ institutionId, date: { $in: dates }, name: rest.name }).lean());
  },
);

router.delete('/holidays/:id', requireRole(...MANAGEMENT), validate({ params: idParam }), async (req, res) => {
  const { institutionId } = tenant(req);
  const holiday = await Holiday.findOneAndDelete({ _id: params<{ id: string }>(req).id, institutionId });
  if (!holiday) throw notFound('Holiday');
  ok(res, holiday);
});

export default router;
