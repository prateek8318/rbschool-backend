import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import { env } from '../../config/env';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../../core/errors';
import { events } from '../../core/events';
import { PLATFORM_MEMBERSHIP_ID } from '../../core/auth';
import { Role } from '../../core/roles';
import { generateRefreshToken, hashToken, signAccessToken } from '../../core/tokens';
import { generateNumericCode, slugify } from '../../core/utils';
import { AcademicSession, defaultSessionWindow } from '../institutions/academic-session.model';
import {
  DEFAULT_TERMINOLOGY,
  defaultAttendanceMode,
  Institution,
  InstitutionType,
} from '../institutions/institution.model';
import { Membership } from './membership.model';
import { Otp } from './otp.model';
import { generateTempPassword } from './user.service';
import { Session } from './session.model';
import { hashPassword, User, UserDoc, verifyPassword } from './user.model';

export interface ClientInfo {
  userAgent?: string;
  ip?: string;
}

export interface MembershipView {
  membershipId: string;
  role: Role;
  institution: { id: string; name: string; code: string; type: string; logoUrl?: string | null };
}

export const listMemberships = async (userId: string | Types.ObjectId): Promise<MembershipView[]> => {
  const memberships = await Membership.find({ userId, status: 'active' })
    .populate<{ institutionId: { _id: Types.ObjectId; name: string; code: string; type: string; logoUrl?: string; isActive: boolean } }>(
      'institutionId',
      'name code type logoUrl isActive',
    )
    .lean();

  return memberships
    .filter((membership) => membership.institutionId?.isActive)
    .map((membership) => ({
      membershipId: String(membership._id),
      role: membership.role,
      institution: {
        id: String(membership.institutionId._id),
        name: membership.institutionId.name,
        code: membership.institutionId.code,
        type: membership.institutionId.type,
        logoUrl: membership.institutionId.logoUrl ?? null,
      },
    }));
};

const accessTokenFor = (user: UserDoc, sessionId: string, membership?: MembershipView) =>
  signAccessToken({
    sub: String(user._id),
    sid: sessionId,
    pa: user.isPlatformAdmin || undefined,
    ...(membership
      ? {
          ...(membership.membershipId === PLATFORM_MEMBERSHIP_ID ? {} : { mid: membership.membershipId }),
          iid: membership.institution.id,
          role: membership.role,
        }
      : {}),
  });

/** A platform admin "entering" an institution acts as its owner. */
const platformView = async (institutionId: string): Promise<MembershipView> => {
  const institution = await Institution.findById(institutionId).select('name code type logoUrl').lean();
  if (!institution) throw notFound('Institution');
  return {
    membershipId: PLATFORM_MEMBERSHIP_ID,
    role: 'owner',
    institution: {
      id: String(institution._id),
      name: institution.name,
      code: institution.code,
      type: institution.type,
      logoUrl: institution.logoUrl ?? null,
    },
  };
};

/** Only people an institution has added (or platform admins) may sign in. */
const assertHasAccess = (user: UserDoc, memberships: MembershipView[]) => {
  if (!user.isPlatformAdmin && memberships.length === 0) {
    throw forbidden('Your account is not active in any institution. Please contact your institution admin.');
  }
};

/** Creates a session and returns everything the app needs after login. */
const startSession = async (user: UserDoc, client: ClientInfo, preferredMembershipId?: string) => {
  const memberships = await listMemberships(user._id);
  assertHasAccess(user, memberships);
  const active =
    memberships.find((membership) => membership.membershipId === preferredMembershipId) ??
    (memberships.length === 1 ? memberships[0] : undefined);

  const refreshToken = generateRefreshToken();
  const session = await Session.create({
    userId: user._id,
    membershipId: active?.membershipId,
    refreshTokenHash: hashToken(refreshToken),
    userAgent: client.userAgent?.slice(0, 300),
    ip: client.ip,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
  });

  user.lastLoginAt = new Date();
  await user.save();

  return {
    accessToken: accessTokenFor(user, String(session._id), active),
    refreshToken,
    user: user.toJSON(),
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
    memberships,
    activeMembership: active ?? null,
    /** True when the user belongs to several institutions and must call /auth/switch. */
    requiresMembershipSelection: !active && memberships.length > 1,
  };
};

const findUserByIdentifier = (identifier: string) => {
  const value = identifier.trim();
  const lower = value.toLowerCase();
  return User.findOne({ $or: [{ email: lower }, { phone: value }, { username: lower }] }).select('+passwordHash');
};

export const login = async (identifier: string, password: string, client: ClientInfo, membershipId?: string) => {
  const user = await findUserByIdentifier(identifier);
  // Same message for unknown user and wrong password, so accounts can't be probed.
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw unauthorized('Invalid login credentials');
  if (!user.isActive) throw forbidden('This account has been deactivated');
  return startSession(user, client, membershipId);
};

// ---------- OTP ----------

const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_MS = 30_000;
const OTP_MAX_ATTEMPTS = 5;

/**
 * OTP is sent only to numbers an institution admin has added (teachers,
 * parents, students, staff) and that are not blocked. This is an invite-only
 * product, so telling the person to contact their admin is the helpful answer.
 */
export const requestOtp = async (phone: string) => {
  const user = await User.findOne({ phone, isActive: true });
  const memberships = user ? await listMemberships(user._id) : [];
  if (!user || (!user.isPlatformAdmin && memberships.length === 0)) {
    throw forbidden('This phone number is not registered or has been blocked. Please contact your institution admin.');
  }

  const existing = await Otp.findOne({ phone });
  if (existing && Date.now() - existing.updatedAt.getTime() < OTP_RESEND_MS) {
    throw badRequest('Please wait 30 seconds before requesting another OTP');
  }

  // A fixed OTP (STATIC_OTP in .env) makes testing easy; never use it in production.
  const code = env.STATIC_OTP ?? generateNumericCode(6);
  await Otp.findOneAndUpdate(
    { phone },
    { codeHash: hashToken(code), attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    { upsert: true },
  );
  events.emit('otp.requested', { phone, code });
  return { sent: true as const, ...(env.OTP_DEV_MODE ? { devCode: code } : {}) };
};

export const verifyOtp = async (phone: string, code: string, client: ClientInfo, membershipId?: string) => {
  const otp = await Otp.findOne({ phone, expiresAt: { $gt: new Date() } });
  if (!otp) throw unauthorized('OTP expired, please request a new one');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw unauthorized('Too many wrong attempts, please request a new OTP');

  const matches = crypto.timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(hashToken(code)));
  if (!matches) {
    otp.attempts += 1;
    await otp.save();
    throw unauthorized('Incorrect OTP');
  }
  await otp.deleteOne();

  const user = await User.findOne({ phone });
  if (!user) throw unauthorized('No account is registered with this phone number');
  if (!user.isActive) throw forbidden('This account has been deactivated');
  if (!user.phoneVerifiedAt) user.phoneVerifiedAt = new Date();
  return startSession(user, client, membershipId);
};

// ---------- Sessions ----------

export const refresh = async (refreshToken: string) => {
  const session = await Session.findOne({
    refreshTokenHash: hashToken(refreshToken),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) throw unauthorized('Invalid or expired refresh token');

  const user = await User.findById(session.userId);
  if (!user?.isActive) throw unauthorized('Account is not active');

  let membership: MembershipView | undefined;
  if (session.membershipId) {
    membership = (await listMemberships(user._id)).find((item) => item.membershipId === String(session.membershipId));
    if (!membership) session.membershipId = undefined;
  } else if (session.platformInstitutionId && user.isPlatformAdmin) {
    membership = await platformView(String(session.platformInstitutionId)).catch(() => undefined);
  }

  const nextRefreshToken = generateRefreshToken();
  session.refreshTokenHash = hashToken(nextRefreshToken);
  await session.save();

  return {
    accessToken: accessTokenFor(user, String(session._id), membership),
    refreshToken: nextRefreshToken,
    activeMembership: membership ?? null,
  };
};

/**
 * Choose what the app acts as:
 * - `membershipId`: one of the user's own memberships
 * - `institutionId`: platform admins only, enter any institution as owner
 * - neither: platform admins leave the institution (back to platform view)
 */
export const switchMembership = async (
  userId: string,
  sessionId: string,
  target: { membershipId?: string; institutionId?: string },
) => {
  const user = await User.findById(userId);
  if (!user) throw unauthorized();

  if (target.membershipId) {
    const membership = (await listMemberships(userId)).find((item) => item.membershipId === target.membershipId);
    if (!membership) throw notFound('Membership');
    await Session.updateOne({ _id: sessionId }, { membershipId: target.membershipId, $unset: { platformInstitutionId: 1 } });
    return { accessToken: accessTokenFor(user, sessionId, membership), activeMembership: membership };
  }

  if (!user.isPlatformAdmin) throw forbidden('Choose one of your institutions');

  if (target.institutionId) {
    const view = await platformView(target.institutionId);
    await Session.updateOne({ _id: sessionId }, { platformInstitutionId: target.institutionId, $unset: { membershipId: 1 } });
    return { accessToken: accessTokenFor(user, sessionId, view), activeMembership: view };
  }

  await Session.updateOne({ _id: sessionId }, { $unset: { membershipId: 1, platformInstitutionId: 1 } });
  return { accessToken: accessTokenFor(user, sessionId), activeMembership: null };
};

export const logout = async (sessionId: string, everywhere: boolean, userId: string) => {
  const filter = everywhere ? { userId, revokedAt: null } : { _id: sessionId };
  await Session.updateMany(filter, { revokedAt: new Date() });
};

export const changePassword = async (userId: string, sessionId: string, currentPassword: string, newPassword: string) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw unauthorized();
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect');

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();
  // Log out every other device.
  await Session.updateMany({ userId, _id: { $ne: sessionId }, revokedAt: null }, { revokedAt: new Date() });
};

// ---------- Institution registration ----------

export interface RegisterInstitutionInput {
  institution: {
    name: string;
    type: InstitutionType;
    affiliation?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
    sessionStartMonth?: number;
  };
  admin: {
    name: string;
    email?: string;
    phone: string;
    password: string;
  };
}

const uniqueInstitutionCode = async (name: string) => {
  const base = slugify(name) || 'institution';
  if (!(await Institution.exists({ code: base }))) return base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${crypto.randomInt(100, 10000)}`;
    if (!(await Institution.exists({ code: candidate }))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
};

export interface CreateInstitutionInput {
  institution: RegisterInstitutionInput['institution'];
  owner: { name: string; email?: string; phone: string; password?: string };
  createdBy?: string;
}

/**
 * Creates an institution, its first academic session and the owner's
 * membership. Re-uses the owner's account if the phone/email already exists.
 * Returns a temporary password only when a brand-new account was created
 * without an explicit password.
 */
export const createInstitution = async (input: CreateInstitutionInput) => {
  const email = input.owner.email?.toLowerCase();
  const existing = await User.findOne({ $or: [{ phone: input.owner.phone }, ...(email ? [{ email }] : [])] });
  const code = await uniqueInstitutionCode(input.institution.name);
  const window = defaultSessionWindow(input.institution.sessionStartMonth ?? 4);
  const tempPassword = !existing && !input.owner.password ? generateTempPassword() : undefined;

  let institutionId!: Types.ObjectId;
  let ownerId!: Types.ObjectId;

  await mongoose.connection.transaction(async (tx) => {
    const owner =
      existing ??
      (
        await User.create(
          [
            {
              name: input.owner.name,
              email,
              phone: input.owner.phone,
              passwordHash: await hashPassword(input.owner.password ?? tempPassword!),
              mustChangePassword: Boolean(tempPassword),
            },
          ],
          { session: tx },
        )
      )[0];
    ownerId = owner._id;

    const [institution] = await Institution.create(
      [
        {
          name: input.institution.name,
          code,
          type: input.institution.type,
          affiliation: input.institution.affiliation,
          email: input.institution.email,
          phone: input.institution.phone,
          address: { city: input.institution.city, state: input.institution.state },
          settings: {
            terminology: DEFAULT_TERMINOLOGY[input.institution.type],
            attendanceMode: defaultAttendanceMode(input.institution.type),
          },
          createdBy: input.createdBy ?? owner._id,
        },
      ],
      { session: tx },
    );
    institutionId = institution._id;

    await Membership.create([{ userId: owner._id, institutionId: institution._id, role: 'owner' }], { session: tx });
    await AcademicSession.create([{ institutionId: institution._id, ...window, isCurrent: true }], { session: tx });
  });

  return {
    institutionId: String(institutionId),
    code,
    ownerUserId: String(ownerId),
    credential: tempPassword ? { name: input.owner.name, role: 'owner' as const, login: input.owner.phone, tempPassword } : null,
  };
};

/** Public self-registration (disabled unless ALLOW_PUBLIC_REGISTRATION=true). */
export const registerInstitution = async (input: RegisterInstitutionInput, client: ClientInfo) => {
  const email = input.admin.email?.toLowerCase();
  const existing = await User.findOne({
    $or: [{ phone: input.admin.phone }, ...(email ? [{ email }] : [])],
  }).select('+passwordHash');

  if (existing && !(await verifyPassword(input.admin.password, existing.passwordHash))) {
    throw conflict('An account with this phone/email already exists. Use its password to add a new institution.');
  }

  const result = await createInstitution({ institution: input.institution, owner: input.admin });
  const user = await User.findById(result.ownerUserId).select('+passwordHash');
  const membership = await Membership.findOne({ userId: result.ownerUserId, institutionId: result.institutionId, role: 'owner' }).lean();
  return startSession(user!, client, String(membership!._id));
};
