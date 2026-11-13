import { Request, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../../core/auth';
import { env } from '../../config/env';
import { forbidden, unauthorized } from '../../core/errors';
import { created, ok } from '../../core/http';
import { objectId, phone, validate } from '../../core/validate';
import { INSTITUTION_TYPES } from '../institutions/institution.model';
import * as auth from './auth.service';
import { User } from './user.model';

const router = Router();

const strictLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

const client = (req: Request): auth.ClientInfo => ({ userAgent: req.header('user-agent'), ip: req.ip });

const password = z.string().min(8, 'Password must be at least 8 characters').max(100);

/** Create a new school / college / institute along with its owner account. */
router.post(
  '/register-institution',
  strictLimiter,
  (_req, _res, next) => {
    if (!env.ALLOW_PUBLIC_REGISTRATION) throw forbidden('New institutions are created by the platform admin. Please contact us.');
    next();
  },
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
        email: z.string().email().optional(),
        phone,
        password,
      }),
    }),
  }),
  async (req, res) => {
    created(res, await auth.registerInstitution(req.body, client(req)), 'Institution registered');
  },
);

/** Login with email, phone or username + password. */
router.post(
  '/login',
  strictLimiter,
  validate({
    body: z.object({
      identifier: z.string().trim().min(3),
      password: z.string().min(1),
      membershipId: objectId.optional(),
    }),
  }),
  async (req, res) => {
    const { identifier, password: pwd, membershipId } = req.body;
    ok(res, await auth.login(identifier, pwd, client(req), membershipId));
  },
);

router.post('/otp/request', strictLimiter, validate({ body: z.object({ phone }) }), async (req, res) => {
  ok(res, await auth.requestOtp(req.body.phone), undefined, 'If this number is registered, an OTP has been sent');
});

router.post(
  '/otp/verify',
  strictLimiter,
  validate({ body: z.object({ phone, code: z.string().regex(/^\d{6}$/), membershipId: objectId.optional() }) }),
  async (req, res) => {
    ok(res, await auth.verifyOtp(req.body.phone, req.body.code, client(req), req.body.membershipId));
  },
);

router.post('/refresh', validate({ body: z.object({ refreshToken: z.string().min(20) }) }), async (req, res) => {
  ok(res, await auth.refresh(req.body.refreshToken));
});

// ----- Authenticated -----

/** Current user and every institution/role they belong to. */
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.auth!.userId);
  if (!user) throw unauthorized();
  const memberships = await auth.listMemberships(user._id);
  const active = req.auth!.membership;
  ok(res, {
    user: user.toJSON(),
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
    memberships,
    activeMembershipId: active?.id ?? null,
    activeInstitutionId: active?.institutionId ?? null,
    activeRole: active?.role ?? null,
  });
});

/**
 * Pick which institution/role the app is acting as.
 * Platform admins may pass `institutionId` to enter any institution as owner,
 * or send an empty body to go back to the platform view.
 */
router.post(
  '/switch',
  authenticate,
  validate({ body: z.object({ membershipId: objectId.optional(), institutionId: objectId.optional() }) }),
  async (req, res) => {
    ok(res, await auth.switchMembership(req.auth!.userId, req.auth!.sessionId, req.body));
  },
);

router.post(
  '/logout',
  authenticate,
  validate({ body: z.object({ everywhere: z.boolean().default(false) }) }),
  async (req, res) => {
    await auth.logout(req.auth!.sessionId, req.body.everywhere, req.auth!.userId);
    ok(res, null, undefined, 'Logged out');
  },
);

router.put(
  '/password',
  authenticate,
  validate({ body: z.object({ currentPassword: z.string().min(1), newPassword: password }) }),
  async (req, res) => {
    await auth.changePassword(req.auth!.userId, req.auth!.sessionId, req.body.currentPassword, req.body.newPassword);
    ok(res, null, undefined, 'Password changed. Other devices have been logged out.');
  },
);

router.patch(
  '/me',
  authenticate,
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(100).optional(),
      avatarUrl: z.string().url().optional(),
    }),
  }),
  async (req, res) => {
    const user = await User.findByIdAndUpdate(req.auth!.userId, req.body, { new: true });
    ok(res, user);
  },
);

export default router;
