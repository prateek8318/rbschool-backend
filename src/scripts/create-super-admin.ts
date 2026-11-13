/**
 * Makes a user a platform (super) admin, creating the account if needed.
 *   npm run create-super-admin -- <phone> <password> "<name>"
 */
import { connectDB, disconnectDB } from '../core/db';
import { hashPassword, User } from '../modules/auth/user.model';

const main = async () => {
  const [phone, password, name = 'Platform Admin'] = process.argv.slice(2);
  if (!phone || !password || password.length < 8) {
    console.error('Usage: npm run create-super-admin -- <phone> <password(min 8)> "<name>"');
    process.exit(1);
  }
  await connectDB();
  const existing = await User.findOne({ phone });
  if (existing) {
    existing.isPlatformAdmin = true;
    await existing.save();
    console.log(`${existing.name} (${phone}) is now a platform admin. Password unchanged.`);
  } else {
    await User.create({ name, phone, passwordHash: await hashPassword(password), isPlatformAdmin: true });
    console.log(`Created platform admin ${name} (${phone}).`);
  }
  await disconnectDB();
};

main().catch(async (error) => {
  console.error(error);
  await disconnectDB();
  process.exit(1);
});
