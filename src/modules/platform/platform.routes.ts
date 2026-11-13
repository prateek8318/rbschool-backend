import { Router } from 'express';
import { z } from 'zod';
import { requirePlatformAdmin } from '../../core/auth';
import { notFound } from '../../core/errors';
import { created, ok } from '../../core/http';
import { pageMeta, searchRegex } from '../../core/utils';
import { idParam, pagination, params, phone, query, validate } from '../../core/validate';
import { createInstitution } from '../auth/auth.service';
import { Membership } from '../auth/membership.model';
import { User } from '../auth/user.model';
import { INSTITUTION_TYPES, Institution } from '../institutions/institution.model';
import { invalidateInstitutionCache } from '../institutions/institution.service';
import { Student } from '../people/people.models';

/** For you (the product owner): every institution on the platform. */
const router = Router();
router.use(requirePlatformAdmin);

router.get('/stats', async (_req, res) => {
  const [institutions, byType, users, students] = await Promise.all([
    Institution.countDocuments(),
    Institution.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    User.countDocuments({ isActive: true }),
    Student.countDocuments({ status: 'active' }),
  ]);
  ok(res, { institutions, byType: Object.fromEntries(byType.map((row) => [row._id, row.count])), users, students });
});

router.get(
  '/institutions',
  validate({ query: pagination.extend({ type: z.enum(INSTITUTION_TYPES).optional(), active: z.enum(['true', 'false']).optional() }) }),
  async (req, res) => {
    const q = query<{ page: number; limit: number; search?: string; type?: string; active?: string }>(req);
    const filter: Record<string, unknown> = {};
    if (q.type) filter.type = q.type;
    if (q.active) filter.isActive = q.active === 'true';
    if (q.search) filter.$or = [{ name: searchRegex(q.search) }, { code: searchRegex(q.search) }];

    const [items, total] = await Promise.all([
      Institution.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Institution.countDocuments(filter),
    ]);
    const studentCounts = await Student.aggregate<{ _id: unknown; count: number }>([
      { $match: { institutionId: { $in: items.map((item) => item._id) }, status: 'active' } },
      { $group: { _id: '$institutionId', count: { $sum: 1 } } },
    ]);
    const counts = new Map(studentCounts.map((row) => [String(row._id), row.count]));
    ok(res, items.map((item) => ({ ...item, studentCount: counts.get(String(item._id)) ?? 0 })), pageMeta(q.page, q.limit, total));
  },
);

/**
 * Onboard a new school / college / coaching institute together with its
 * admin. The admin can then sign in with their phone number (OTP) or the
 * temporary password returned here, and add teachers and parents.
 */
router.post(
  '/institutions',
  validate({
    body: z.object({
      institution: z.object({
        name: z.string().trim().min(2).max(150),
        type: z.enum(INSTITUTION_TYPES),
        affiliation: z.string().trim().max(100).optional(),
        email: z.string().email().optional(),
        phone: phone.optional(),
        city: z.string().trim().max(80).optional(),
        state: z.string().trim().max(80).optional(),
        sessionStartMonth: z.number().int().min(1).max(12).optional(),
      }),
      admin: z.object({
        name: z.string().trim().min(2).max(100),
        phone,
        email: z.string().email().optional(),
        password: z.string().min(6).max(100).optional(),
      }),
    }),
  }),
  async (req, res) => {
    const result = await createInstitution({ institution: req.body.institution, owner: req.body.admin, createdBy: req.auth!.userId });
    created(res, { ...result, institution: await Institution.findById(result.institutionId).lean() }, 'Institution created');
  },
);

router.get('/institutions/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const institution = await Institution.findById(id).lean();
  if (!institution) throw notFound('Institution');
  const owners = await Membership.find({ institutionId: id, role: { $in: ['owner', 'admin'] } }).populate('userId', 'name phone email').lean();
  ok(res, { ...institution, admins: owners });
});

/** Suspend / re-activate an institution (all its users lose access while suspended). */
router.patch('/institutions/:id/status', validate({ params: idParam, body: z.object({ isActive: z.boolean() }) }), async (req, res) => {
  const { id } = params<{ id: string }>(req);
  const institution = await Institution.findByIdAndUpdate(id, { isActive: req.body.isActive }, { new: true });
  if (!institution) throw notFound('Institution');
  invalidateInstitutionCache(id);
  ok(res, institution);
});

export default router;
