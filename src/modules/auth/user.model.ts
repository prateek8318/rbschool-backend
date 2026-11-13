import bcrypt from 'bcryptjs';
import { InferSchemaType, Schema, model, HydratedDocument } from 'mongoose';

/**
 * A person's login identity. Global across institutions: the same phone
 * number is the same person everywhere, and Membership records say what
 * that person is in each institution.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    /** Login handle for people without phone/email (e.g. young students). */
    username: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, select: false },
    mustChangePassword: { type: Boolean, default: false },
    avatarUrl: { type: String },
    isPlatformAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    /** Set the first time the person proves they own the phone (OTP login). */
    phoneVerifiedAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });
userSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });

userSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserAttrs>;
export const User = model('User', userSchema);

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash?: string | null) =>
  hash ? bcrypt.compare(plain, hash) : Promise.resolve(false);
