import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireRole, tenant } from '../../core/auth';
import { badRequest, notFound } from '../../core/errors';
import { created, ok } from '../../core/http';
import { EVERYONE, MANAGEMENT } from '../../core/roles';
import { dateString, idParam, params, phone, validate } from '../../core/validate';
import { AcademicSession } from './academic-session.model';
import { Institution } from './institution.model';
import { invalidateInstitutionCache } from './institution.service';

const router = Router();

/** The active institution, including terminology the apps should display. */
router.get('/', requireRole(...EVERYONE), async (req, res) => {
  const { institutionId } = tenant(req);
  const [institution, currentSession] = await Promise.all([
    Institution.findById(institutionId).lean(),
    AcademicSession.findOne({ institutionId, isCurrent: true }).lean(),
  ]);
  if (!institution) throw notFound('Institution');
  ok(res, { ...institution, currentSession });
});

router.patch(
  '/',
  requireRole(...MANAGEMENT),
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(150).optional(),
      affiliation: z.string().trim().max(100).optional(),
      email: z.string().email().optional(),
      phone: phone.optional(),
      website: z.string().url().optional(),
      logoUrl: z.string().url().optional(),
      timezone: z.string().optional(),
      currency: z.string().length(3).optional(),
      address: z
        .object({
          line1: z.string().max(200).optional(),
          city: z.string().max(80).optional(),
          state: z.string().max(80).optional(),
          country: z.string().max(80).optional(),
          pincode: z.string().max(12).optional(),
        })
        .optional(),
    }),
  }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const { address, ...rest } = req.body as { address?: Record<string, string> } & Record<string, unknown>;
    const update: Record<string, unknown> = { ...rest };
    for (const [key, value] of Object.entries(address ?? {})) update[`address.${key}`] = value;

    const institution = await Institution.findByIdAndUpdate(institutionId, { $set: update }, { new: true, runValidators: true });
    invalidateInstitutionCache(institutionId);
    ok(res, institution);
  },
);

router.patch(
  '/settings',
  requireRole(...MANAGEMENT),
  validate({
    body: z.object({
      terminology: z
        .object({
          program: z.string().max(40),
          batch: z.string().max(40),
          session: z.string().max(40),
          student: z.string().max(40),
          guardian: z.string().max(40),
          teacher: z.string().max(40),
          enrollmentNo: z.string().max(40),
        })
        .partial()
        .optional(),
      attendanceMode: z.enum(['daily', 'per_period']).optional(),
      workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
      gradingScale: z
        .array(z.object({ min: z.number().min(0).max(100), grade: z.string().min(1).max(5), gradePoint: z.number().optional() }))
        .min(1)
        .refine((bands) => bands.some((band) => band.min === 0), 'Grading scale must include a band starting at 0')
        .optional(),
      passPercentage: z.number().min(0).max(100).optional(),
      lowAttendanceThreshold: z.number().min(0).max(100).optional(),
      notifyGuardiansOnAbsence: z.boolean().optional(),
      sendFeeReminders: z.boolean().optional(),
    }),
  }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const { terminology, gradingScale, ...rest } = req.body as {
      terminology?: Record<string, string>;
      gradingScale?: Array<{ min: number }>;
    } & Record<string, unknown>;

    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) update[`settings.${key}`] = value;
    for (const [key, value] of Object.entries(terminology ?? {})) update[`settings.terminology.${key}`] = value;
    if (gradingScale) update['settings.gradingScale'] = [...gradingScale].sort((a, b) => b.min - a.min);

    const institution = await Institution.findByIdAndUpdate(institutionId, { $set: update }, { new: true, runValidators: true });
    invalidateInstitutionCache(institutionId);
    ok(res, institution?.settings);
  },
);

// ---------- Academic sessions ----------

const sessionBody = z
  .object({
    name: z.string().trim().min(2).max(40),
    startDate: dateString,
    endDate: dateString,
  })
  .refine((value) => value.startDate < value.endDate, { message: 'endDate must be after startDate', path: ['endDate'] });

router.get('/sessions', requireRole(...EVERYONE), async (req, res) => {
  const { institutionId } = tenant(req);
  ok(res, await AcademicSession.find({ institutionId }).sort({ startDate: -1 }).lean());
});

router.post('/sessions', requireRole(...MANAGEMENT), validate({ body: sessionBody }), async (req, res) => {
  const { institutionId } = tenant(req);
  const hasCurrent = await AcademicSession.exists({ institutionId, isCurrent: true });
  created(res, await AcademicSession.create({ ...req.body, institutionId, isCurrent: !hasCurrent }));
});

router.patch(
  '/sessions/:id',
  requireRole(...MANAGEMENT),
  validate({ params: idParam, body: z.object({ name: z.string().trim().min(2).max(40), startDate: dateString, endDate: dateString }).partial() }),
  async (req, res) => {
    const { institutionId } = tenant(req);
    const session = await AcademicSession.findOne({ _id: params<{ id: string }>(req).id, institutionId });
    if (!session) throw notFound('Academic session');
    session.set(req.body);
    if (session.startDate >= session.endDate) throw badRequest('endDate must be after startDate');
    await session.save();
    ok(res, session);
  },
);

/** Make a session the current one (e.g. at the start of a new academic year). */
router.post('/sessions/:id/activate', requireRole(...MANAGEMENT), validate({ params: idParam }), async (req, res) => {
  const { institutionId } = tenant(req);
  const { id } = params<{ id: string }>(req);
  if (!(await AcademicSession.exists({ _id: id, institutionId }))) throw notFound('Academic session');

  await mongoose.connection.transaction(async (tx) => {
    await AcademicSession.updateMany({ institutionId, isCurrent: true }, { isCurrent: false }, { session: tx });
    await AcademicSession.updateOne({ _id: id }, { isCurrent: true }, { session: tx });
  });
  ok(res, await AcademicSession.findById(id));
});

export default router;
