import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from './roles';
import { unauthorized } from './errors';

export interface AccessTokenPayload {
  /** User id */
  sub: string;
  /** Session id (used to revoke on logout) */
  sid: string;
  /** Active membership id, absent until the user picks an institution */
  mid?: string;
  /** Active institution id */
  iid?: string;
  /** Role inside the active institution */
  role?: Role;
  /** Platform (super) admin flag */
  pa?: boolean;
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'] });

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw unauthorized('Invalid or expired access token');
  }
};

/** Refresh tokens are opaque random strings; only their hash is stored. */
export const generateRefreshToken = () => crypto.randomBytes(48).toString('base64url');

export const hashToken = (token: string) =>
  crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
