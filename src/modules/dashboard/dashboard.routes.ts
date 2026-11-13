import { Router } from 'express';
import { Types } from 'mongoose';
import { oid, requireRole, TenantContext, tenant } from '../../core/auth';
import { ok } from '../../core/http';
import { EVERYONE } from '../../core/roles';
import { dayOfWeek, round, todayIn } from '../../core/utils';
import { Batch, TimetableSlot } from '../academics/academics.models';
import { teacherBatchIds } from '../academics/batch-access';
import { AttendanceSheet } from '../attendance/attendance.models';
import { attendanceStats, statsFor } from '../attendance/attendance.service';
import { Announcement, Notification } from '../communication/communication.models';
import { Exam, ExamResult } from '../exams/exams.models';
import { Invoice, Payment } from '../fees/fees.models';
import { AcademicSession } from '../institutions/academic-session.model';
import { getInstitutionSettings } from '../institutions/institution.service';
import { LeaveRequest } from '../leaves/leaves.model';
import { Staff, Student } from '../people/people.models';
import { myStudents } from '../people/student-access';

const router = Router();

const recentAnnouncements = (ctx: TenantContext) =>
  Announcement.find({
    institutionId: ctx.institutionId,
    $or: [{ 'audience.roles': { $size: 0 } }, { 'audience.roles': ctx.role }],
  })
    .select('title createdAt isPinned')
    .sort({ isPinned: -1, createdAt: -1 })
    .limit(5)
    .lean();

const upcomingExams = (institutionId: string, sessionId: unknown, today: string, batchIds?: unknown[]) =>
  Exam.find({
    institutionId,
    sessionId,
    'papers.date': { $gte: today },
    ...(batchIds ? { batchIds: { $in: batchIds } } : {}),
  })
    .select('name type papers.date papers.subjectId batchIds')
    .populate('papers.subjectId', 'name')
    .sort({ 'papers.date': 1 })
    .limit(5)
    .lean();

const todaysTimetable = (institutionId: string, date: string, filter: Record<string, unknown>) =>
  TimetableSlot.find({ institutionId, dayOfWeek: dayOfWeek(date), ...filter })
    .populate('subjectId', 'name')
    .populate('batchId', 'name')
    .populate('teacherId', 'name')
    .sort({ startTime: 1 })
    .lean();

const adminDashboard = async (ctx: TenantContext, today: string, sessionId: Types.ObjectId | undefined) => {
  const institutionId = oid(ctx.institutionId);
  const month = today.slice(0, 7);
  const [students, staff, batches, todaySheets, feeTotals, monthCollection, pendingLeaves, exams, announcements] = await Promise.all([
    Student.countDocuments({ institutionId, status: 'active' }),
    Staff.countDocuments({ institutionId, status: 'active' }),
    Batch.countDocuments({ institutionId, sessionId, isActive: true }),
    AttendanceSheet.find({ institutionId, date: today }).select('batchId counts').lean(),
    Invoice.aggregate([
      { $match: { institutionId, sessionId, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, billed: { $sum: '$totalAmount' }, collected: { $sum: '$paidAmount' }, outstanding: { $sum: '$balance' } } },
    ]),
    Payment.aggregate([
      { $match: { institutionId, status: 'success', paidAt: { $gte: `${month}-01`, $lte: `${month}-31` } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
    LeaveRequest.countDocuments({ institutionId, status: 'pending' }),
    upcomingExams(ctx.institutionId, sessionId, today),
    recentAnnouncements(ctx),
  ]);

  const present = todaySheets.reduce((sum, sheet) => sum + (sheet.counts?.present ?? 0) + (sheet.counts?.late ?? 0), 0);
  const absent = todaySheets.reduce((sum, sheet) => sum + (sheet.counts?.absent ?? 0) + (sheet.counts?.leave ?? 0), 0);
  const fees = feeTotals[0] ?? { billed: 0, collected: 0, outstanding: 0 };

  return {
    counts: { students, staff, batches },
    attendanceToday: {
      batchesMarked: new Set(todaySheets.map((sheet) => String(sheet.batchId))).size,
      batchesTotal: batches,
      present,
      absent,
      percentage: present + absent ? round((present / (present + absent)) * 100) : null,
    },
    fees: {
      billed: round(fees.billed),
      collected: round(fees.collected),
      outstanding: round(fees.outstanding),
      collectedThisMonth: round(monthCollection[0]?.amount ?? 0),
      overdueInvoices: await Invoice.countDocuments({ institutionId, status: 'overdue' }),
    },
    pendingLeaves,
    upcomingExams: exams,
    announcements,
  };
};

const teacherDashboard = async (ctx: TenantContext, today: string, sessionId: Types.ObjectId | undefined) => {
  const batchIds = await teacherBatchIds(ctx.institutionId, ctx.userId);
  const [schedule, batches, markedToday, coordinated, exams, announcements] = await Promise.all([
    todaysTimetable(ctx.institutionId, today, { teacherId: ctx.userId }),
    Batch.find({ _id: { $in: batchIds } }).select('name programId coordinatorId').populate('programId', 'name').lean(),
    AttendanceSheet.find({ batchId: { $in: batchIds }, date: today }).select('batchId period').lean(),
    Batch.find({ institutionId: ctx.institutionId, coordinatorId: ctx.userId, isActive: true }).select('_id').lean(),
    upcomingExams(ctx.institutionId, sessionId, today, batchIds),
    recentAnnouncements(ctx),
  ]);
  const marked = new Set(markedToday.map((sheet) => String(sheet.batchId)));
  const pendingStudentLeaves = await LeaveRequest.countDocuments({
    institutionId: ctx.institutionId,
    status: 'pending',
    batchId: { $in: coordinated.map((batch) => batch._id) },
  });

  return {
    todaySchedule: schedule,
    batches: batches.map((batch) => ({
      ...batch,
      isCoordinator: String(batch.coordinatorId ?? '') === ctx.userId,
      attendanceMarkedToday: marked.has(String(batch._id)),
    })),
    pendingStudentLeaves,
    upcomingExams: exams,
    announcements,
  };
};

/** Students and guardians: one card per child. */
const learnerDashboard = async (ctx: TenantContext, today: string, sessionId: Types.ObjectId | undefined, sessionStart?: string) => {
  const students = await myStudents(ctx);
  const ids = students.map((student) => student._id);
  const batchIds = students.map((student) => student.batchId).filter(Boolean);

  const [stats, invoices, latestResults, schedule, exams, announcements] = await Promise.all([
    attendanceStats(ctx.institutionId, ids, { from: sessionStart }),
    Invoice.find({ institutionId: ctx.institutionId, studentId: { $in: ids }, status: { $nin: ['cancelled', 'paid'] } })
      .select('studentId balance nextDueDate status')
      .lean(),
    ExamResult.find({ institutionId: ctx.institutionId, studentId: { $in: ids } })
      .populate<{ examId: { name: string; status: string } | null }>('examId', 'name status')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean(),
    todaysTimetable(ctx.institutionId, today, { batchId: { $in: batchIds } }),
    upcomingExams(ctx.institutionId, sessionId, today, batchIds),
    recentAnnouncements(ctx),
  ]);

  return {
    children: students.map((student) => {
      const key = String(student._id);
      const due = invoices.filter((invoice) => String(invoice.studentId) === key);
      const result = latestResults.find((item) => String(item.studentId) === key && item.examId?.status === 'published');
      return {
        student: { id: student._id, name: student.name, enrollmentNo: student.enrollmentNo, photoUrl: student.photoUrl, batchId: student.batchId },
        attendance: statsFor(stats, key),
        fees: {
          balance: round(due.reduce((sum, invoice) => sum + invoice.balance, 0)),
          nextDueDate: due.map((invoice) => invoice.nextDueDate).filter(Boolean).sort()[0] ?? null,
          overdue: due.some((invoice) => invoice.status === 'overdue'),
        },
        latestResult: result
          ? { exam: result.examId?.name, percentage: result.percentage, grade: result.grade, rank: result.rank, result: result.result }
          : null,
        todaySchedule: schedule.filter((slot) => String((slot.batchId as unknown as { _id: unknown })?._id) === String(student.batchId)),
      };
    }),
    upcomingExams: exams,
    announcements,
  };
};

/** Single home-screen call for every app; the shape depends on the active role. */
router.get('/', requireRole(...EVERYONE), async (req, res) => {
  const ctx = tenant(req);
  const institution = await getInstitutionSettings(ctx.institutionId);
  const today = todayIn(institution.timezone);
  const session = await AcademicSession.findOne({ institutionId: ctx.institutionId, isCurrent: true }).lean();
  const unreadNotifications = await Notification.countDocuments({ institutionId: ctx.institutionId, userId: ctx.userId, readAt: null });

  const base = { role: ctx.role, today, session: session ? { id: session._id, name: session.name } : null, unreadNotifications };

  switch (ctx.role) {
    case 'owner':
    case 'admin':
      return ok(res, { ...base, ...(await adminDashboard(ctx, today, session?._id)) });
    case 'accountant': {
      const admin = await adminDashboard(ctx, today, session?._id);
      return ok(res, { ...base, fees: admin.fees, announcements: admin.announcements });
    }
    case 'teacher':
      return ok(res, { ...base, ...(await teacherDashboard(ctx, today, session?._id)) });
    case 'student':
    case 'guardian':
      return ok(res, { ...base, ...(await learnerDashboard(ctx, today, session?._id, session?.startDate)) });
    default:
      return ok(res, { ...base, announcements: await recentAnnouncements(ctx) });
  }
});

export default router;
