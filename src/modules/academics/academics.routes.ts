import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireRole, tenant } from '../../core/auth';
import { badRequest, conflict, notFound } from '../../core/errors';
import { created, ok } from '../../core/http';
import { ACADEMIC_STAFF, EVERYONE, MANAGEMENT } from '../../core/roles';
import { assertMembers, assertOwned } from '../../core/tenancy';
import { idParam, objectId, params, query, timeString, validate } from '../../core/validate';
import { AcademicSession, getCurrentSession } from '../institutions/academic-session.model';
import { Student } from '../people/people.models';
import { myStudents } from '../people/student-access';
import { Batch, Program, Subject, TimetableSlot } from './academics.models';
import { loadBatch, teacherBatchIds } from './batch-access';

const router = Router();

// ======================= Programs =======================

const programBody = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(30).optional(),
  description: z.string().max(500).optional(),
  level: z.number().int().min(0).max(1000).optional(),
  duration: z.string().max(40).optional(),
});

router.get(
  '/programs',
  requireRole(...EVERYONE),
  validate({ query: z.object({ includeInactive: z.coerce.boolean().default(false) }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const { includeInactive } = query<{ includeInactive: boolean }>(req);
    ok(res, await Program.find({ institutionId, ...(includeInactive ? {} : { isActive: true }) }).sort({ level: 1, name: 1 }).lean());
  },
);

router.post('/programs', requireRole(...MANAGEMENT), validate({ body: programBody }), async (req, res) => {
  const { institutionId } = tenant(req);
  if (await Program.exists({ institutionId, name: req.body.name })) throw conflict('A program with this name already exists');
  created(res, await Program.create({ ...req.body, institutionId }));
});

router.patch(
  '/programs/:id',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: programBody.partial().extend({ isActive: z.boolean().optional() }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const program = await Program.findOneAndUpdate({ _id: params<{ id: string }>(req).id, institutionId }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!program) throw notFound('Program');
    ok(res, program);
  },
);

// ======================= Subjects =======================

const subjectBody = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(30).optional(),
  type: z.enum(['theory', 'practical', 'activity', 'other']).optional(),
  credits: z.number().min(0).max(100).optional(),
  programIds: z.array(objectId).optional(),
});

router.get(
  '/subjects',
  requireRole(...EVERYONE),
  validate({ query: z.object({ programId: objectId.optional() }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const { programId } = query<{ programId?: string }>(req);
    ok(res, await Subject.find({ institutionId, isActive: true, ...(programId ? { programIds: programId } : {}) }).sort({ name: 1 }).lean());
  },
);

router.post('/subjects', requireRole(...MANAGEMENT), validate({ body: subjectBody }), async (req, res) => {
  const { institutionId } = tenant(req);
  await assertOwned(Program, institutionId, req.body.programIds ?? [], 'programs');
  created(res, await Subject.create({ ...req.body, institutionId }));
});

router.patch(
  '/subjects/:id',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: subjectBody.partial().extend({ isActive: z.boolean().optional() }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    await assertOwned(Program, institutionId, req.body.programIds ?? [], 'programs');
    const subject = await Subject.findOneAndUpdate({ _id: params<{ id: string }>(req).id, institutionId }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!subject) throw notFound('Subject');
    ok(res, subject);
  },
);

// ======================= Batches =======================

const batchSubjects = z.array(z.object({ subjectId: objectId, teacherId: objectId.optional() }));

const batchBody = z.object({
  programId: objectId,
  sessionId: objectId.optional(),
  name: z.string().trim().min(1).max(60),
  coordinatorId: objectId.optional(),
  room: z.string().max(40).optional(),
  capacity: z.number().int().min(1).max(10000).optional(),
  subjects: batchSubjects.optional(),
});

const validateBatchRefs = async (
  institutionId: string,
  body: { programId?: string; sessionId?: string; coordinatorId?: string; subjects?: Array<{ subjectId: string; teacherId?: string }> },
) => {
  await assertOwned(Program, institutionId, [body.programId], 'programs');
  await assertOwned(AcademicSession, institutionId, [body.sessionId], 'sessions');
  await assertOwned(Subject, institutionId, (body.subjects ?? []).map((item) => item.subjectId), 'subjects');
  await assertMembers(
    institutionId,
    [body.coordinatorId, ...(body.subjects ?? []).map((item) => item.teacherId)],
    ['teacher', 'admin', 'owner'],
    'teachers',
  );
};

/** Students/guardians see their own batches; teachers can filter to `mine`. */
router.get(
  '/batches',
  requireRole(...EVERYONE),
  validate({
    query: z.object({
      sessionId: objectId.optional(),
      programId: objectId.optional(),
      mine: z.coerce.boolean().default(false),
    }),
  }),
  async (req, res) => {
    const ctx = tenant(req);
    const q = query<{ sessionId?: string; programId?: string; mine: boolean }>(req);
    const sessionId = q.sessionId ?? (await getCurrentSession(ctx.institutionId))._id;

    const filter: Record<string, unknown> = { institutionId: ctx.institutionId, sessionId, isActive: true };
    if (q.programId) filter.programId = q.programId;
    if (ctx.role === 'teacher' && q.mine) filter._id = { $in: await teacherBatchIds(ctx.institutionId, ctx.userId) };
    if (ctx.role === 'student' || ctx.role === 'guardian') {
      filter._id = { $in: (await myStudents(ctx)).map((student) => student.batchId).filter(Boolean) };
    }

    const batches = await Batch.find(filter)
      .populate('programId', 'name code level')
      .populate('coordinatorId', 'name phone')
      .sort({ name: 1 })
      .lean();

    const counts = await Student.aggregate<{ _id: unknown; count: number }>([
      { $match: { institutionId: new mongoose.Types.ObjectId(ctx.institutionId), batchId: { $in: batches.map((b) => b._id) }, status: 'active' } },
      { $group: { _id: '$batchId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((item) => [String(item._id), item.count]));

    ok(res, batches.map((batch) => ({ ...batch, studentCount: countMap.get(String(batch._id)) ?? 0 })));
  },
);

router.post('/batches', requireRole(...MANAGEMENT), validate({ body: batchBody }), async (req, res) => {
  const { institutionId } = tenant(req);
  const body = { ...req.body, sessionId: req.body.sessionId ?? String((await getCurrentSession(institutionId))._id) };
  await validateBatchRefs(institutionId, body);
  if (await Batch.exists({ institutionId, sessionId: body.sessionId, programId: body.programId, name: body.name })) {
    throw conflict('A batch with this name already exists for this program and session');
  }
  created(res, await Batch.create({ ...body, institutionId }));
});

router.get('/batches/:id', requireRole(...EVERYONE), validate({ params: idParam }), async (req, res) => {
  const { institutionId } = tenant(req);
  const batch = await Batch.findOne({ _id: params<{ id: string }>(req).id, institutionId })
    .populate('programId', 'name code level')
    .populate('sessionId', 'name startDate endDate')
    .populate('coordinatorId', 'name phone email')
    .populate('subjects.subjectId', 'name code type')
    .populate('subjects.teacherId', 'name phone')
    .lean();
  if (!batch) throw notFound('Batch');
  ok(res, batch);
});

router.patch(
  '/batches/:id',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: batchBody.partial().omit({ sessionId: true }).extend({ isActive: z.boolean().optional() }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    await validateBatchRefs(institutionId, req.body);
    const batch = await Batch.findOneAndUpdate({ _id: params<{ id: string }>(req).id, institutionId }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!batch) throw notFound('Batch');
    ok(res, batch);
  },
);

/** Assign subjects and the teacher for each subject. Replaces the list. */
router.put(
  '/batches/:id/subjects',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: z.object({ subjects: batchSubjects }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    await validateBatchRefs(institutionId, req.body);
    const batch = await Batch.findOneAndUpdate(
      { _id: params<{ id: string }>(req).id, institutionId },
      { subjects: req.body.subjects },
      { new: true },
    );
    if (!batch) throw notFound('Batch');
    ok(res, batch);
  },
);

router.get('/batches/:id/students', requireRole(...ACADEMIC_STAFF, 'accountant', 'staff'), validate({ params: idParam }), async (req, res) => {
  const { institutionId } = tenant(req);
  const batch = await loadBatch(institutionId, params<{ id: string }>(req).id);
  const students = await Student.find({ institutionId, batchId: batch._id, status: 'active' })
    .select('name enrollmentNo rollNo photoUrl gender guardians.name guardians.phone guardians.relation')
    .sort({ rollNo: 1, name: 1 })
    .lean();
  ok(res, students);
});

// ======================= Timetable =======================

const slotBody = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeString,
    endTime: timeString,
    subjectId: objectId.optional(),
    teacherId: objectId.optional(),
    room: z.string().max(40).optional(),
    label: z.string().max(40).optional(),
  })
  .refine((slot) => slot.startTime < slot.endTime, { message: 'endTime must be after startTime' });

const overlaps = (a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) =>
  a.startTime < b.endTime && b.startTime < a.endTime;

/**
 * Weekly timetable. Pass `batchId` for a batch, `teacherId` for a teacher,
 * or nothing to get "my" timetable (teacher / student / guardian's children).
 */
router.get(
  '/timetable',
  requireRole(...EVERYONE),
  validate({ query: z.object({ batchId: objectId.optional(), teacherId: objectId.optional(), dayOfWeek: z.coerce.number().int().min(0).max(6).optional() }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const q = query<{ batchId?: string; teacherId?: string; dayOfWeek?: number }>(req);
    const filter: Record<string, unknown> = { institutionId: ctx.institutionId };

    if (q.batchId) filter.batchId = q.batchId;
    else if (q.teacherId) filter.teacherId = q.teacherId;
    else if (ctx.role === 'student' || ctx.role === 'guardian') {
      filter.batchId = { $in: (await myStudents(ctx)).map((student) => student.batchId).filter(Boolean) };
    } else filter.teacherId = ctx.userId;

    if (q.dayOfWeek !== undefined) filter.dayOfWeek = q.dayOfWeek;

    const slots = await TimetableSlot.find(filter)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name')
      .populate('batchId', 'name')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();
    ok(res, slots);
  },
);

/** Replace a batch's whole weekly timetable. Rejects teacher double-booking. */
router.put(
  '/timetable/batches/:id',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: z.object({ slots: z.array(slotBody).max(200) }) }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const batch = await loadBatch(institutionId, params<{ id: string }>(req).id);
    const slots = req.body.slots as Array<z.infer<typeof slotBody>>;

    await assertOwned(Subject, institutionId, slots.map((slot) => slot.subjectId), 'subjects');
    await assertMembers(institutionId, slots.map((slot) => slot.teacherId), ['teacher', 'admin', 'owner'], 'teachers');

    // Overlaps inside this batch
    for (const [index, slot] of slots.entries()) {
      const clash = slots.find((other, otherIndex) => otherIndex !== index && other.dayOfWeek === slot.dayOfWeek && overlaps(slot, other));
      if (clash) throw badRequest(`Two periods overlap on day ${slot.dayOfWeek} at ${slot.startTime}`);
    }

    // Teacher booked in another batch at the same time
    const teacherIds = [...new Set(slots.map((slot) => slot.teacherId).filter(Boolean))];
    if (teacherIds.length) {
      const others = await TimetableSlot.find({ institutionId, teacherId: { $in: teacherIds }, batchId: { $ne: batch._id } })
        .populate('batchId', 'name')
        .lean<Array<{ teacherId: unknown; dayOfWeek: number; startTime: string; endTime: string; batchId: { name: string } }>>();
      for (const slot of slots) {
        const clash = others.find(
          (other) => String(other.teacherId) === slot.teacherId && other.dayOfWeek === slot.dayOfWeek && overlaps(slot, other),
        );
        if (clash) {
          throw conflict(`Teacher is already teaching ${clash.batchId?.name ?? 'another batch'} on day ${slot.dayOfWeek} at ${clash.startTime}`);
        }
      }
    }

    await mongoose.connection.transaction(async (tx) => {
      await TimetableSlot.deleteMany({ institutionId, batchId: batch._id }, { session: tx });
      if (slots.length) {
        await TimetableSlot.insertMany(slots.map((slot) => ({ ...slot, institutionId, batchId: batch._id })), { session: tx });
      }
    });

    ok(res, await TimetableSlot.find({ institutionId, batchId: batch._id }).sort({ dayOfWeek: 1, startTime: 1 }).lean());
  },
);

export default router;
