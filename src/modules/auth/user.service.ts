import crypto from 'crypto';
import { ClientSession } from 'mongoose';
import { badRequest, conflict } from '../../core/errors';
import { hashPassword, User, UserDoc } from './user.model';

export interface PersonInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
}

/** Readable temporary password, e.g. "kite-4821-Moon". */
export const generateTempPassword = () => {
  const words = ['Sun', 'Moon', 'Star', 'Kite', 'Lake', 'Tree', 'Rose', 'Blue', 'Gold', 'Rain'];
  const pick = () => words[crypto.randomInt(words.length)];
  return `${pick().toLowerCase()}-${crypto.randomInt(1000, 10000)}-${pick()}`;
};

/**
 * Finds the person by phone/email/username or creates a new account with a
 * temporary password. Returns the temp password only for newly created users.
 */
export const findOrCreateUser = async (
  input: PersonInput,
  session?: ClientSession,
): Promise<{ user: UserDoc; created: boolean; tempPassword?: string }> => {
  const email = input.email?.trim().toLowerCase() || undefined;
  const phone = input.phone?.trim() || undefined;
  const username = input.username?.trim().toLowerCase() || undefined;
  if (!email && !phone && !username) throw badRequest('A phone number, email or username is required');

  const or = [
    ...(phone ? [{ phone }] : []),
    ...(email ? [{ email }] : []),
    ...(username ? [{ username }] : []),
  ];
  const matches = await User.find({ $or: or }).session(session ?? null);
  if (matches.length > 1) {
    throw conflict('This phone number and email belong to two different accounts');
  }

  const existing = matches[0];
  if (existing) {
    // Fill in contact details the account doesn't have yet.
    let changed = false;
    if (email && !existing.email) {
      existing.email = email;
      changed = true;
    }
    if (phone && !existing.phone) {
      existing.phone = phone;
      changed = true;
    }
    if (changed) await existing.save({ session });
    return { user: existing, created: false };
  }

  const tempPassword = generateTempPassword();
  const [user] = await User.create(
    [
      {
        name: input.name,
        email,
        phone,
        username,
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
      },
    ],
    { session },
  );
  return { user, created: true, tempPassword };
};
