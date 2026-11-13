import { env } from '../../config/env';
import { hashPassword, User } from './user.model';

/**
 * Makes sure the platform (super) admin from .env exists. The password is
 * only set when the account is created; change it later from the app.
 */
export const ensureSuperAdmin = async () => {
  if (!env.SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_PASSWORD) return;
  const email = env.SUPER_ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    if (!existing.isPlatformAdmin || !existing.isActive) {
      existing.isPlatformAdmin = true;
      existing.isActive = true;
      await existing.save();
    }
    return;
  }
  await User.create({
    name: env.SUPER_ADMIN_NAME,
    email,
    passwordHash: await hashPassword(env.SUPER_ADMIN_PASSWORD),
    isPlatformAdmin: true,
  });
  console.log(`Super admin created: ${email}`);
};
