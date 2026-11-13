import { Router } from 'express';
import { z } from 'zod';
import { requireRole, TenantContext, tenant } from '../../core/auth';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors';
import { events } from '../../core/events';
import { created, ok } from '../../core/http';
import { ACADEMIC_STAFF, EMPLOYEES, EVERYONE, isManagement, LEARNERS, MANAGEMENT } from '../../core/roles';
import { assertOwned } from '../../core/tenancy';
import { round, todayIn } from '../../core/utils';
import { dateString, idParam, objectId, params, query, timeString, validate } from '../../core/validate';
import { Batch, Subject } from '../academics/academics.models';
import { loadBatch, teacherBatchIds, teachesBatch } from '../academics/batch-access';
import { getCurrentSession } from '../institutions/academic-session.model';
import { getInstitutionSettings } from '../institutions/institution.service';
import { Student } from '../people/people.models';
import { assertCanViewStudent, myStudents } from '../people/student-access';
import { Exam, ExamAttrs, ExamResult, EXAM_TYPES } from './exams.models';
import { assignRanks, computeResult } from './grading';

const router = Router();

const paperBody = z
  .object({
    subjectId: objectId,
    date: dateString,
    startTime: timeString.optional(),
    durationMinutes: z.number().int().min(5).max(600).optional(),
    maxMarks: z.number().positive().max(1000),
    passMarks: z.number().min(0).optional(),
  })
  .refine((paper) => paper.passMarks === undefined || paper.passMarks <= paper.maxMarks, {
    message: 'passMarks cannot exceed maxMarks',
  });

const examBody = z.object({
  name: z.string().trim().min(2).max(100),
  type: z.enum(EXAM_TYPES).optional(),
  batchIds: z.array(objectId).min(1),
  papers: z.array(paperBody).min(1).max(30),
  instructions: z.string().max(2000).optional(),
});

const loadExam = async (institutionId: string, examId: string) => {
  const exam = await Exam.findOne({ _id: examId, institutionId }).lean<ExamAttrs>();
  if (!exam) throw notFound('Exam');
  return exam;
};

const validateExamRefs = async (institutionId: string, body: { batchIds?: string[]; papers?: Array<{ subjectId: string }> }) => {
  await assertOwned(Batch, institutionId, body.batchIds ?? [], 'batches');
  const subjectIds = (body.papers ?? []).map((paper) => paper.subjectId);
  if (new Set(subjectIds).size !== subjectIds.length) throw badRequest('Each subject can have only one paper per exam');
  await assertOwned(Subject, institutionId, subjectIds, 'subjects');
};

/** Learners only see exams of their own batches; teachers optionally `mine`. */
router.get(
  '/',
  requireRole(...EVERYONE),
  validate({
    query: z.object({
      sessionId: objectId.optional(),
      batchId: objectId.optional(),
      status: z.enum(['scheduled', 'published']).optional(),
      upcoming: z.coerce.boolean().optional(),
      mine: z.coerce.boolean().optional(),
    }),
  }),
  async (req, res) => {
    const ctx = tenant(req);
    const q = query<{ sessionId?: string; batchId?: string; status?: string; upcoming?: boolean; mine?: boolean }>(req);
    const filter: Record<string, unknown> = {
      institutionId: ctx.institutionId,
      sessionId: q.sessionId ?? (await getCurrentSession(ctx.institutionId))._id,
    };
    if (q.status) filter.status = q.status;
    if (q.batchId) filter.batchIds = q.batchId;
    if (ctx.role === 'student' || ctx.role === 'guardian') {
      const batchIds = (await myStudents(ctx)).map((student) => student.batchId).filter(Boolean);
      filter.batchIds = q.batchId ? { $in: batchIds.filter((id) => String(id) === q.batchId) } : { $in: batchIds };
    } else if (ctx.role === 'teacher' && q.mine) {
      filter.batchIds = { $in: await teacherBatchIds(ctx.institutionId, ctx.userId) };
    }
    if (q.upcoming) {
      const institution = await getInstitutionSettings(ctx.institutionId);
      filter['papers.date'] = { $gte: todayIn(institution.timezone) };
    }

    const exams = await Exam.find(filter)
      .populate('batchIds', 'name')
      .populate('papers.subjectId', 'name code')
      .sort({ 'papers.date': 1 })
      .lean();
    ok(res, exams);
  },
);

router.post('/', requireRole(...MANAGEMENT), validate({ body: examBody }), async (req, res) => {
  const ctx = tenant(req);
  await validateExamRefs(ctx.institutionId, req.body);
  const session = await getCurrentSession(ctx.institutionId);
  const exam = await Exam.create({ ...req.body, institutionId: ctx.institutionId, sessionId: session._id, createdBy: ctx.userId });

  const firstDate = [...exam.papers].map((paper) => paper.date).sort()[0];
  events.emit('exam.scheduled', {
    institutionId: ctx.institutionId,
    examId: String(exam._id),
    examName: exam.name,
    batchIds: exam.batchIds.map(String),
    startDate: firstDate,
  });
  created(res, exam);
});

router.get('/:id', requireRole(...EVERYONE), validate({ params: idParam }), async (req, res) => {
  const { institutionId } = tenant(req);
  const exam = await Exam.findOne({ _id: params<{ id: string }>(req).id, institutionId })
    .populate('batchIds', 'name')
    .populate('papers.subjectId', 'name code')
    .lean();
  if (!exam) throw notFound('Exam');
  ok(res, exam);
});

router.patch(
  '/:id',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: examBody.partial() }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    await validateExamRefs(institutionId, req.body);
    const exam = await Exam.findOne({ _id: params<{ id: string }>(req).id, institutionId });
    if (!exam) throw notFound('Exam');
    if (exam.status === 'published' && (req.body.papers || req.body.batchIds)) {
      throw badRequest('Unpublish the results before changing papers or batches');
    }
    exam.set(req.body);
    await exam.save();
    ok(res, exam);
  },
);

router.delete('/:id', requireRole(...MANAGEMENT), validate({ params: idParam }), async (req, res) => {
  const { institutionId } = tenant(req);
  const { id } = params<{ id: string }>(req);
  if (await ExamResult.exists({ examId: id, institutionId })) throw conflict('Marks have already been entered for this exam');
  const exam = await Exam.findOneAndDelete({ _id: id, institutionId });
  if (!exam) throw notFound('Exam');
  ok(res, exam);
});

// ---------------- Marks entry ----------------

/** Management, the batch coordinator, or the teacher of that subject in that batch. */
const assertCanEnterMarks = async (ctx: TenantContext, exam: ExamAttrs, batchId: string, subjectId: string) => {
  if (!exam.batchIds.some((id) => String(id) === batchId)) throw badRequest('This exam is not for that batch');
  if (!exam.papers.some((paper) => String(paper.subjectId) === subjectId)) throw badRequest('This exam has no paper for that subject');
  const batch = await loadBatch(ctx.institutionId, batchId);
  if (isManagement(ctx.role)) return batch;
  const teachesSubject = batch.subjects.some(
    (subject) => String(subject.subjectId) === subjectId && String(subject.teacherId ?? '') === ctx.userId,
  );
  if (String(batch.coordinatorId ?? '') === ctx.userId || teachesSubject) return batch;
  throw forbidden('You do not teach this subject in this batch');
};

/** Marks sheet for one subject in one batch (what the teacher fills in). */
router.get(
  '/:id/marks',
  requireRole(...ACADEMIC_STAFF),
  validate({ params: idParam, query: z.object({ batchId: objectId, subjectId: objectId }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const exam = await loadExam(ctx.institutionId, params<{ id: string }>(req).id);
    const { batchId, subjectId } = query<{ batchId: string; subjectId: string }>(req);
    await assertCanEnterMarks(ctx, exam, batchId, subjectId);

    const [students, results] = await Promise.all([
      Student.find({ institutionId: ctx.institutionId, batchId, status: 'active' }).select('name enrollmentNo rollNo').sort({ rollNo: 1, name: 1 }).lean(),
      ExamResult.find({ examId: exam._id, batchId }).select('studentId scores').lean(),
    ]);
    const paper = exam.papers.find((item) => String(item.subjectId) === subjectId)!;
    const scoreMap = new Map(
      results.map((result) => [String(result.studentId), result.scores.find((score) => String(score.subjectId) === subjectId)]),
    );

    ok(res, {
      exam: { id: exam._id, name: exam.name, status: exam.status },
      paper,
      students: students.map((student) => {
        const score = scoreMap.get(String(student._id));
        return { ...student, marks: score?.marks ?? null, isAbsent: score?.isAbsent ?? false, remark: score?.remark ?? null };
      }),
    });
  },
);

router.put(
  '/:id/marks',
  requireRole(...ACADEMIC_STAFF),
  validate({
    params: idParam,
    body: z.object({
      batchId: objectId,
      subjectId: objectId,
      entries: z
        .array(
          z.object({
            studentId: objectId,
            marks: z.number().min(0).nullable().optional(),
            isAbsent: z.boolean().default(false),
            remark: z.string().max(200).optional(),
          }),
        )
        .min(1),
    }),
  }),
  async (req, res) => {
    const ctx = tenant(req);
    const exam = await loadExam(ctx.institutionId, params<{ id: string }>(req).id);
    const { batchId, subjectId, entries } = req.body as {
      batchId: string;
      subjectId: string;
      entries: Array<{ studentId: string; marks?: number | null; isAbsent: boolean; remark?: string }>;
    };
    await assertCanEnterMarks(ctx, exam, batchId, subjectId);
    if (exam.status === 'published' && !isManagement(ctx.role)) {
      throw forbidden('Results are published. Ask an admin to unpublish before changing marks.');
    }

    const paper = exam.papers.find((item) => String(item.subjectId) === subjectId)!;
    const tooHigh = entries.find((entry) => (entry.marks ?? 0) > paper.maxMarks);
    if (tooHigh) throw badRequest(`Marks cannot exceed ${paper.maxMarks}`);

    const studentIds = entries.map((entry) => entry.studentId);
    const inBatch = await Student.countDocuments({ _id: { $in: studentIds }, institutionId: ctx.institutionId, batchId });
    if (inBatch !== new Set(studentIds).size) throw badRequest('Some students do not belong to this batch');

    const institution = await getInstitutionSettings(ctx.institutionId);
    const existing = await ExamResult.find({ examId: exam._id, studentId: { $in: studentIds } });
    const existingMap = new Map(existing.map((result) => [String(result.studentId), result]));

    for (const entry of entries) {
      const result =
        existingMap.get(entry.studentId) ??
        new ExamResult({ institutionId: ctx.institutionId, examId: exam._id, studentId: entry.studentId, batchId, scores: [] });

      const score = {
        subjectId,
        marks: entry.isAbsent ? null : entry.marks ?? null,
        isAbsent: entry.isAbsent,
        remark: entry.remark,
        enteredBy: ctx.userId,
      };
      const index = result.scores.findIndex((item) => String(item.subjectId) === subjectId);
      if (index >= 0) result.scores.splice(index, 1, score as never);
      else result.scores.push(score as never);

      const plainScores = result.scores.map((item) => ({ subjectId: item.subjectId, marks: item.marks, isAbsent: item.isAbsent, grade: item.grade }));
      const computed = computeResult(exam.papers, plainScores, institution.settings);
      plainScores.forEach((item, i) => (result.scores[i].grade = item.grade ?? undefined));
      result.set(computed);
      await result.save();
    }

    ok(res, { saved: entries.length }, undefined, 'Marks saved');
  },
);

/** Finalise grades and ranks and make results visible to students/guardians. */
router.post('/:id/publish', requireRole(...MANAGEMENT), validate({ params: idParam }), async (req, res) => {
  const ctx = tenant(req);
  const exam = await loadExam(ctx.institutionId, params<{ id: string }>(req).id);
  const results = await ExamResult.find({ examId: exam._id });
  if (!results.length) throw badRequest('No marks have been entered yet');

  for (const batchId of exam.batchIds.map(String)) {
    const batchResults = results.filter((result) => String(result.batchId) === batchId);
    for (const { row, rank } of assignRanks(batchResults)) row.rank = rank;
  }
  await ExamResult.bulkSave(results);
  await Exam.updateOne({ _id: exam._id }, { status: 'published', resultsPublishedAt: new Date() });

  events.emit('exam.results_published', {
    institutionId: ctx.institutionId,
    examId: String(exam._id),
    examName: exam.name,
    batchIds: exam.batchIds.map(String),
  });
  ok(res, { published: true, results: results.length, incomplete: results.filter((result) => result.result === 'incomplete').length });
});

router.post('/:id/unpublish', requireRole(...MANAGEMENT), validate({ params: idParam }), async (req, res) => {
  const { institutionId } = tenant(req);
  const exam = await Exam.findOneAndUpdate({ _id: params<{ id: string }>(req).id, institutionId }, { status: 'scheduled', $unset: { resultsPublishedAt: 1 } }, { new: true });
  if (!exam) throw notFound('Exam');
  ok(res, exam);
});

/** Full results table of a batch with class statistics. */
router.get(
  '/:id/results',
  requireRole(...ACADEMIC_STAFF),
  validate({ params: idParam, query: z.object({ batchId: objectId }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const exam = await loadExam(ctx.institutionId, params<{ id: string }>(req).id);
    const { batchId } = query<{ batchId: string }>(req);
    const batch = await loadBatch(ctx.institutionId, batchId);
    if (!isManagement(ctx.role) && !teachesBatch(batch, ctx.userId)) throw forbidden('You are not assigned to this batch');

    const results = await ExamResult.find({ examId: exam._id, batchId })
      .populate('studentId', 'name enrollmentNo rollNo')
      .sort({ rank: 1, totalMarks: -1 })
      .lean();

    const institution = await getInstitutionSettings(ctx.institutionId);
    const complete = results.filter((result) => result.result !== 'incomplete');
    const subjects = exam.papers.map((paper) => {
      const marks = results
        .map((result) => result.scores.find((score) => String(score.subjectId) === String(paper.subjectId)))
        .filter((score) => score && !score.isAbsent && score.marks !== null && score.marks !== undefined)
        .map((score) => score!.marks as number);
      const passMarks = paper.passMarks ?? (paper.maxMarks * institution.settings.passPercentage) / 100;
      return {
        subjectId: paper.subjectId,
        maxMarks: paper.maxMarks,
        entered: marks.length,
        average: marks.length ? round(marks.reduce((a, b) => a + b, 0) / marks.length) : null,
        highest: marks.length ? Math.max(...marks) : null,
        lowest: marks.length ? Math.min(...marks) : null,
        passMarks,
        passed: marks.filter((mark) => mark >= passMarks).length,
      };
    });

    ok(res, {
      exam: { id: exam._id, name: exam.name, status: exam.status, papers: exam.papers },
      summary: {
        students: results.length,
        complete: complete.length,
        passed: complete.filter((result) => result.result === 'pass').length,
        failed: complete.filter((result) => result.result === 'fail').length,
        averagePercentage: complete.length ? round(complete.reduce((sum, r) => sum + r.percentage, 0) / complete.length) : null,
        highestPercentage: complete.length ? Math.max(...complete.map((r) => r.percentage)) : null,
      },
      subjects,
      results,
    });
  },
);

/** Report card: a student's published results (employees also see unpublished ones). */
router.get(
  '/results/students/:id',
  requireRole(...EMPLOYEES, ...LEARNERS),
  validate({ params: idParam, query: z.object({ sessionId: objectId.optional() }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const { id } = params<{ id: string }>(req);
    await assertCanViewStudent(ctx, id);
    const sessionId = query<{ sessionId?: string }>(req).sessionId ?? (await getCurrentSession(ctx.institutionId))._id;

    const examFilter: Record<string, unknown> = { institutionId: ctx.institutionId, sessionId };
    if (ctx.role === 'student' || ctx.role === 'guardian') examFilter.status = 'published';
    const exams = await Exam.find(examFilter).populate('papers.subjectId', 'name code').sort({ 'papers.date': 1 }).lean();

    const results = await ExamResult.find({ studentId: id, examId: { $in: exams.map((exam) => exam._id) } }).lean();
    const resultMap = new Map(results.map((result) => [String(result.examId), result]));

    ok(
      res,
      exams
        .filter((exam) => resultMap.has(String(exam._id)))
        .map((exam) => ({
          exam: { id: exam._id, name: exam.name, type: exam.type, status: exam.status, papers: exam.papers },
          result: resultMap.get(String(exam._id)),
        })),
    );
  },
);

export default router;
