import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { Membership } from '../modules/auth/membership.model';
import { Session } from '../modules/auth/session.model';
import { User } from '../modules/auth/user.model';
import { getInstitutionSettings } from '../modules/institutions/institution.service';

/** Marker membership id used when a platform admin enters an institution. */
export const PLATFORM_MEMBERSHIP_ID = 'platform';
import { forbidden, unauthorized } from './errors';
import { Role } from './roles';
import { verifyAccessToken } from './tokens';

export interface AuthInfo {
  userId: string;
  sessionId: string;
  isPlatformAdmin: boolean;
  membership?: {
    id: string;
    institutionId: string;
    role: Role;
  };
}

/** Context for a request that is scoped to one institution. */
export interface TenantContext {
  userId: string;
  institutionId: string;
  role: Role;
  membershipId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthInfo;
    }
  }
}

/**
 * Verifies the bearer token and, when the token is scoped to an institution,
 * re-checks that the membership is still active (so removing someone takes
 * effect immediately, not after the token expires).
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  const payload = verifyAccessToken(header.slice(7));

  const session = await Session.exists({ _id: payload.sid, revokedAt: null, expiresAt: { $gt: new Date() } });
  if (!session) throw unauthorized('Session has ended, please log in again');

  const auth: AuthInfo = { userId: payload.sub, sessionId: payload.sid, isPlatformAdmin: Boolean(payload.pa) };

  if (payload.mid) {
    const membership = await Membership.findOne({ _id: payload.mid, userId: payload.sub, status: 'active' })
      .select('institutionId role')
      .lean();
    if (!membership) throw unauthorized('Your access to this institution has been removed');
    const institution = await getInstitutionSettings(membership.institutionId);
    if (!institution.isActive) throw forbidden('This institution is currently suspended');
    auth.membership = {
      id: String(membership._id),
      institutionId: String(membership.institutionId),
      role: membership.role,
    };
  } else if (payload.pa && payload.iid) {
    // Platform admin working inside an institution: acts as its owner.
    const user = await User.exists({ _id: payload.sub, isPlatformAdmin: true, isActive: true });
    if (!user) throw unauthorized('Platform admin access has been removed');
    await getInstitutionSettings(payload.iid);
    auth.membership = { id: PLATFORM_MEMBERSHIP_ID, institutionId: payload.iid, role: 'owner' };
  }

  req.auth = auth;
  next();
};

/** Requires the request to be scoped to an institution, optionally restricted to roles. */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const membership = req.auth?.membership;
    if (!membership) throw forbidden('Select an institution first (POST /api/v1/auth/switch)');
    if (roles.length && !roles.includes(membership.role)) throw forbidden();
    next();
  };

export const requirePlatformAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth?.isPlatformAdmin) throw forbidden('Platform admin access required');
  next();
};

/** Returns the tenant context; use only on routes guarded by `requireRole`. */
export const tenant = (req: Request): TenantContext => {
  const membership = req.auth?.membership;
  if (!req.auth || !membership) throw forbidden('Select an institution first');
  return {
    userId: req.auth.userId,
    institutionId: membership.institutionId,
    role: membership.role,
    membershipId: membership.id,
  };
};

export const oid = (id: string | Types.ObjectId) => (typeof id === 'string' ? new Types.ObjectId(id) : id);
