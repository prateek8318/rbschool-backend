import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireRole, TenantContext, tenant } from '../../core/auth';
import { forbidden, notFound } from '../../core/errors';
import { created, ok } from '../../core/http';
import { ACADEMIC_STAFF, EVERYONE, isManagement, ROLES } from '../../core/roles';
import { assertOwned } from '../../core/tenancy';
import { pageMeta } from '../../core/utils';
import { idParam, objectId, pagination, params, query, validate } from '../../core/validate';
import { Batch, Program } from '../academics/academics.models';
import { teacherBatchIds } from '../academics/batch-access';
import { Membership } from '../auth/membership.model';
import { Student } from '../people/people.models';
import { myStudents } from '../people/student-access';
import { Announcement, DeviceToken, Notification } from './communication.models';
import { notify } from './notify';

// ============================ Announcements ============================

export const announcementsRouter = Router();

const announcementBody = z.object({
  title: z.string().trim().min(2).max(150),
  body: z.string().trim().min(1).max(5000),
  audience: z
    .object({
      roles: z.array(z.enum(ROLES)).default([]),
      batchIds: z.array(objectId).default([]),
      programIds: z.array(objectId).default([]),
    })
    .default({}),
  attachments: z.array(z.object({ name: z.string().max(100), url: z.string().url() })).max(10).optional(),
  isPinned: z.boolean().optional(),
  expiresAt: z.coerce.date().optional(),
});
type AnnouncementInput = z.infer<typeof announcementBody>;

/** Feed filter: what the current user is allowed to see. */
const feedFilter = async (ctx: TenantContext) => {
  const base: Record<string, unknown> = {
    institutionId: ctx.institutionId,
    $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
      { $or: [{ 'audience.roles': { $size: 0 } }, { 'audience.roles': ctx.role }] },
    ],
  };
  if (isManagement(ctx.role)) return base;

  let batchIds: Types.ObjectId[] = [];
  let programIds: Types.ObjectId[] = [];
  if (ctx.role === 'student' || ctx.role === 'guardian') {
    const students = await myStudents(ctx);
    batchIds = students.map((student) => student.batchId).filter(Boolean) as Types.ObjectId[];
    programIds = students.map((student) => student.programId).filter(Boolean) as Types.ObjectId[];
  } else if (ctx.role === 'teacher') {
    batchIds = await teacherBatchIds(ctx.institutionId, ctx.userId);
    programIds = (await Batch.find({ _id: { $in: batchIds } }).select('programId').lean()).map((batch) => batch.programId);
  }

  (base.$and as unknown[]).push(
    { $or: [{ 'audience.batchIds': { $size: 0 } }, { 'audience.batchIds': { $in: batchIds } }] },
    { $or: [{ 'audience.programIds': { $size: 0 } }, { 'audience.programIds': { $in: programIds } }] },
  );
  // Posts that target batches/programs are only for people linked to them.
  return base;
};

/** Every user id the announcement reaches (for notifications). */
const audienceUserIds = async (institutionId: string, audience: AnnouncementInput['audience']) => {
  const roles = audience.roles.length ? audience.roles : [...ROLES];
  const targeted = audience.batchIds.length || audience.programIds.length;
  const ids: Array<Types.ObjectId | string> = [];

  const learnerRoles = roles.filter((role) => role === 'student' || role === 'guardian');
  if (learnerRoles.length) {
    const filter: Record<string, unknown> = { institutionId, status: 'active' };
    if (audience.batchIds.length) filter.batchId = { $in: audience.batchIds };
    if (audience.programIds.length) filter.programId = { $in: audience.programIds };
    const students = await Student.find(filter).select('userId guardians.userId').lean();
    for (const student of students) {
      if (learnerRoles.includes('student') && student.userId) ids.push(student.userId);
      if (learnerRoles.includes('guardian')) ids.push(...student.guardians.map((guardian) => guardian.userId));
    }
  }

  const employeeRoles = roles.filter((role) => role !== 'student' && role !== 'guardian');
  if (employeeRoles.length) {
    if (targeted) {
      // Only teachers linked to those batches/programs.
      if (employeeRoles.includes('teacher')) {
        const batchFilter: Record<string, unknown> = { institutionId, isActive: true };
        if (audience.batchIds.length) batchFilter._id = { $in: audience.batchIds };
        if (audience.programIds.length) batchFilter.programId = { $in: audience.programIds };
        const batches = await Batch.find(batchFilter).select('coordinatorId subjects.teacherId').lean();
        for (const batch of batches) {
          if (batch.coordinatorId) ids.push(batch.coordinatorId);
          for (const subject of batch.subjects) if (subject.teacherId) ids.push(subject.teacherId);
        }
      }
    } else {
      ids.push(...(await Membership.distinct('userId', { institutionId, role: { $in: employeeRoles }, status: 'active' })));
    }
  }
  return ids;
};

announcementsRouter.get(
  '/',
  requireRole(...EVERYONE),
  validate({ query: pagination }),
  async (req, res) => {
    const ctx = tenant(req);
    const q = query<{ page: number; limit: number }>(req);
    const filter = await feedFilter(ctx);
    const [items, total] = await Promise.all([
      Announcement.find(filter)
        .populate('createdBy', 'name')
        .sort({ isPinned: -1, createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      Announcement.countDocuments(filter),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  },
);

/** Management can post to anyone; teachers only to batches they teach. */
announcementsRouter.post('/', requireRole(...ACADEMIC_STAFF), validate({ body: announcementBody }), async (req, res) => {
  const ctx = tenant(req);
  const body = req.body as AnnouncementInput;
  await assertOwned(Batch, ctx.institutionId, body.audience.batchIds, 'batches');
  await assertOwned(Program, ctx.institutionId, body.audience.programIds, 'programs');

  if (ctx.role === 'teacher') {
    const mine = new Set((await teacherBatchIds(ctx.institutionId, ctx.userId)).map(String));
    if (!body.audience.batchIds.length || body.audience.batchIds.some((id) => !mine.has(id)) || body.audience.programIds.length) {
      throw forbidden('Teachers can only post to batches they teach');
    }
  }

  const announcement = await Announcement.create({ ...body, institutionId: ctx.institutionId, createdBy: ctx.userId });
  const userIds = (await audienceUserIds(ctx.institutionId, body.audience)).filter((id) => String(id) !== ctx.userId);
  notify({
    institutionId: ctx.institutionId,
    userIds,
    title: body.title,
    body: body.body.slice(0, 200),
    category: 'announcement',
    data: { type: 'announcement', id: String(announcement._id) },
  }).catch((error) => console.error('[announcements] notify failed', error));

  created(res, { ...announcement.toObject(), recipients: new Set(userIds.map(String)).size });
});

const loadOwnAnnouncement = async (ctx: TenantContext, id: string) => {
  const announcement = await Announcement.findOne({ _id: id, institutionId: ctx.institutionId });
  if (!announcement) throw notFound('Announcement');
  if (!isManagement(ctx.role) && String(announcement.createdBy) !== ctx.userId) throw forbidden();
  return announcement;
};

announcementsRouter.patch(
  '/:id',
  requireRole(...ACADEMIC_STAFF),
  validate({ params: idParam, body: announcementBody.omit({ audience: true }).partial() }),
  async (req, res) => {
    const announcement = await loadOwnAnnouncement(tenant(req), params<{ id: string }>(req).id);
    announcement.set(req.body);
    await announcement.save();
    ok(res, announcement);
  },
);

announcementsRouter.delete('/:id', requireRole(...ACADEMIC_STAFF), validate({ params: idParam }), async (req, res) => {
  const announcement = await loadOwnAnnouncement(tenant(req), params<{ id: string }>(req).id);
  await announcement.deleteOne();
  ok(res, { deleted: true });
});

// ============================ Notifications ============================

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  requireRole(...EVERYONE),
  validate({ query: pagination.extend({ unreadOnly: z.coerce.boolean().default(false) }) }),
  async (req, res) => {
    const ctx = tenant(req);
    const q = query<{ page: number; limit: number; unreadOnly: boolean }>(req);
    const filter: Record<string, unknown> = { institutionId: ctx.institutionId, userId: ctx.userId };
    if (q.unreadOnly) filter.readAt = null;
    const [items, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ institutionId: ctx.institutionId, userId: ctx.userId, readAt: null }),
    ]);
    ok(res, items, { ...pageMeta(q.page, q.limit, total), unread });
  },
);

notificationsRouter.get('/unread-count', requireRole(...EVERYONE), async (req, res) => {
  const ctx = tenant(req);
  ok(res, { unread: await Notification.countDocuments({ institutionId: ctx.institutionId, userId: ctx.userId, readAt: null }) });
});

notificationsRouter.post('/:id/read', requireRole(...EVERYONE), validate({ params: idParam }), async (req, res) => {
  const ctx = tenant(req);
  await Notification.updateOne({ _id: params<{ id: string }>(req).id, userId: ctx.userId, readAt: null }, { readAt: new Date() });
  ok(res, { read: true });
});

notificationsRouter.post('/read-all', requireRole(...EVERYONE), async (req, res) => {
  const ctx = tenant(req);
  const result = await Notification.updateMany(
    { institutionId: ctx.institutionId, userId: ctx.userId, readAt: null },
    { readAt: new Date() },
  );
  ok(res, { updated: result.modifiedCount });
});

/** Mobile apps register their push token after login. Works for any institution. */
notificationsRouter.post(
  '/devices',
  validate({ body: z.object({ token: z.string().min(10).max(500), platform: z.enum(['android', 'ios', 'web']) }) }),
  async (req, res) => {
    await DeviceToken.findOneAndUpdate(
      { token: req.body.token },
      { userId: req.auth!.userId, platform: req.body.platform },
      { upsert: true },
    );
    ok(res, { registered: true });
  },
);

notificationsRouter.delete(
  '/devices',
  validate({ body: z.object({ token: z.string().min(10).max(500) }) }),
  async (req, res) => {
    await DeviceToken.deleteOne({ token: req.body.token, userId: req.auth!.userId });
    ok(res, { removed: true });
  },
);
