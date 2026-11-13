import { Router } from 'express';
import { z } from 'zod';
import { requireRole, TenantContext, tenant } from '../../core/auth';
import { badRequest, forbidden, notFound } from '../../core/errors';
import { events } from '../../core/events';
import { created, ok } from '../../core/http';
import { ACADEMIC_STAFF, EMPLOYEES, EVERYONE, isManagement } from '../../core/roles';
import { pageMeta } from '../../core/utils';
import { dateString, idParam, objectId, pagination, params, query, validate } from '../../core/validate';
import { Batch } from '../academics/academics.models';
import { myStudents } from '../people/student-access';
import { LeaveRequest } from './leaves.model';


const router = Router();

router.post(
  '/',
  requireRole(...EVERYONE),
  validate({
    body: z
      .object({
        type: z.enum(['casual', 'sick', 'emergency', 'family', 'other']).default('casual'),
        fromDate: dateString,
        toDate: dateString,
        reason: z.string().trim().min(3).max(1000),
        studentId: objectId.optional(),
      })
      .refine((body) => body.fromDate <= body.toDate, { message: 'toDate must be on or after fromDate', path: ['toDate'] }),
  }),
  async (req, res) => {
    const ctx = tenant(req);
    const body = { ...req.body } as { studentId?: string; batchId?: unknown } & Record<string, unknown>;

    if (ctx.role === 'student' || ctx.role === 'guardian') {
      const students = await myStudents(ctx);
      const student = body.studentId
        ? students.find((item) => String(item._id) === body.studentId)
        : students.length === 1
          ? students[0]
          : undefined;
      if (!student) throw badRequest(body.studentId ? 'You cannot apply leave for this student' : 'studentId is required');
      body.studentId = String(student._id);
      body.batchId = student.batchId;
    } else {
      delete body.studentId; // employees apply for themselves
    }

    created(
      res,
      await LeaveRequest.create({ ...body, institutionId: ctx.institutionId, applicantUserId: ctx.userId, applicantRole: ctx.role }),
    );
  },
);

router.get('/mine', requireRole(...EVERYONE), validate({ query: pagination }), async (req, res) => {
  const ctx = tenant(req);
  const q = query<{ page: number; limit: number }>(req);
  const filter = { institutionId: ctx.institutionId, applicantUserId: ctx.userId };
  const [items, total] = await Promise.all([
    LeaveRequest.find(filter).populate('studentId', 'name').sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    LeaveRequest.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(q.page, q.limit, total));
});

/** Batches whose student leaves this teacher reviews (as coordinator). */
const coordinatedBatchIds = async (ctx: TenantContext) =>
  (await Batch.find({ institutionId: ctx.institutionId, coordinatorId: ctx.userId, isActive: true }).select('_id').lean()).map((b) => b._id);

/** Requests waiting for (or reviewed by) the current reviewer. */
router.get(
  '/',
  requireRole(...ACADEMIC_STAFF),
  validate({
    query: pagination.extend({
      status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
      kind: z.enum(['staff', 'student']).optional(),
      batchId: objectId.optional(),
    }),
  }),
  async (req, res) => {
    const ctx = tenant(req);
    const q = query<{ page: number; limit: number; status?: string; kind?: 'staff' | 'student'; batchId?: string }>(req);
    const filter: Record<string, unknown> = { institutionId: ctx.institutionId };
    if (q.status) filter.status = q.status;

    if (isManagement(ctx.role)) {
      if (q.kind === 'staff') filter.studentId = { $exists: false };
      if (q.kind === 'student') filter.studentId = { $exists: true };
      if (q.batchId) filter.batchId = q.batchId;
    } else {
      const batchIds = await coordinatedBatchIds(ctx);
      filter.batchId = q.batchId ? { $in: batchIds.filter((id) => String(id) === q.batchId) } : { $in: batchIds };
    }

    const [items, total] = await Promise.all([
      LeaveRequest.find(filter)
        .populate('applicantUserId', 'name phone')
        .populate('studentId', 'name enrollmentNo rollNo')
        .populate('batchId', 'name')
        .sort({ status: 1, fromDate: 1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      LeaveRequest.countDocuments(filter),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  },
);

router.post(
  '/:id/review',
  requireRole(...ACADEMIC_STAFF),
  validate({ params: idParam, body: z.object({ status: z.enum(['approved', 'rejected']), note: z.string().max(500).optional() }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const leave = await LeaveRequest.findOne({ _id: params<{ id: string }>(req).id, institutionId: ctx.institutionId });
    if (!leave) throw notFound('Leave request');
    if (leave.status !== 'pending') throw badRequest(`This request is already ${leave.status}`);
    if (String(leave.applicantUserId) === ctx.userId) throw forbidden('You cannot review your own leave');

    if (!isManagement(ctx.role)) {
      const allowed = leave.batchId && (await coordinatedBatchIds(ctx)).some((id) => String(id) === String(leave.batchId));
      if (!allowed) throw forbidden('Only admins or the class coordinator can review this request');
    }

    leave.set({ status: req.body.status, reviewNote: req.body.note, reviewedBy: ctx.userId, reviewedAt: new Date() });
    await leave.save();

    events.emit('leave.reviewed', {
      institutionId: ctx.institutionId,
      userId: String(leave.applicantUserId),
      status: req.body.status,
      fromDate: leave.fromDate,
      toDate: leave.toDate,
    });
    ok(res, leave);
  },
);

router.post('/:id/cancel', requireRole(...EVERYONE), validate({ params: idParam }), async (req, res) => {
  const ctx = tenant(req);
  const leave = await LeaveRequest.findOne({ _id: params<{ id: string }>(req).id, institutionId: ctx.institutionId, applicantUserId: ctx.userId });
  if (!leave) throw notFound('Leave request');
  if (leave.status !== 'pending') throw badRequest('Only pending requests can be cancelled');
  leave.status = 'cancelled';
  await leave.save();
  ok(res, leave);
});

/** Who is on approved leave on a date (staff planning / attendance hints). */
router.get(
  '/on-leave',
  requireRole(...EMPLOYEES),
  validate({ query: z.object({ date: dateString }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const { date } = query<{ date: string }>(req);
    const filter: Record<string, unknown> = { institutionId: ctx.institutionId, status: 'approved', fromDate: { $lte: date }, toDate: { $gte: date } };
    ok(res, await LeaveRequest.find(filter).populate('applicantUserId', 'name').populate('studentId', 'name batchId').lean());
  },
);

export default router;
