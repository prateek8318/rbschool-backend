import bcrypt from 'bcryptjs';
import mongoose, { HydratedDocument, Model, Schema } from 'mongoose';
import { redisClient } from '../config/redis';

export interface IAuthUser {
  userId: string;
  schoolId: string;
  role: 'admin' | 'teacher' | 'parent';
  passwordHash?: string;
  refreshToken?: string;
  otp?: string;
  otpExpiresAt?: Date;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuthUserMethods {
  comparePassword(plain: string): Promise<boolean>;
  generateOTP(): Promise<string>;
}

type AuthUserModel = Model<IAuthUser, object, IAuthUserMethods>;

const authUserSchema = new Schema<IAuthUser, AuthUserModel, IAuthUserMethods>(
  {
    userId: { type: String, required: true, unique: true, trim: true },
    schoolId: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'teacher', 'parent'], required: true },
    passwordHash: { type: String },
    refreshToken: { type: String },
    otp: { type: String },
    otpExpiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  {
    timestamps: true,
  },
);

authUserSchema.methods.comparePassword = async function comparePassword(
  this: HydratedDocument<IAuthUser, IAuthUserMethods>,
  plain: string,
): Promise<boolean> {
  if (!this.passwordHash) {
    return false;
  }

  return bcrypt.compare(plain, this.passwordHash);
};

authUserSchema.methods.generateOTP = async function generateOTP(
  this: HydratedDocument<IAuthUser, IAuthUserMethods>,
): Promise<string> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  this.otp = otp;
  this.otpExpiresAt = expiresAt;
  await this.save();
  await redisClient.set(`otp-user:${this.userId}`, otp, 'EX', 300);

  return otp;
};

export const AuthUser = mongoose.model<IAuthUser, AuthUserModel>('AuthUser', authUserSchema);
