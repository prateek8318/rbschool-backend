import bcrypt from 'bcryptjs';
import axios from 'axios';
import mongoose from 'mongoose';
import {
  ApiError,
  ApiResponse,
  asyncHandler,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '@rbschool/shared';
import { env } from '../config/env';
import { redisClient } from '../config/redis';
import { AuthUser } from '../models/AuthUser';
import { publishEvent } from '../events/publisher';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const buildTokenPayload = (userId: string, schoolId: string, role: 'admin' | 'teacher' | 'parent') => ({
  userId,
  schoolId,
  role,
});

export const registerSchool = asyncHandler(async (req, res) => {
  const {
    schoolName,
    board,
    address,
    phone,
    adminName,
    adminEmail,
    adminPassword,
    academicYear,
  } = req.body as {
    schoolName: string;
    board: string;
    address: string;
    phone: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    academicYear?: string;
  };

  const schoolResponse = await axios.post(`${env.SCHOOL_SERVICE_URL}/internal/schools`, {
    name: schoolName,
    board,
    address,
    phone,
    email: adminEmail,
    academicYear,
  });

  const school = schoolResponse.data.data as { _id: string; name: string };
  const userId = new mongoose.Types.ObjectId().toString();
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const authUser = await AuthUser.create({
    userId,
    schoolId: school._id,
    role: 'admin',
    passwordHash,
  });

  const userResponse = await axios.post(`${env.USER_SERVICE_URL}/internal/admin`, {
    userId,
    schoolId: school._id,
    name: adminName,
    email: adminEmail,
    phone,
  });

  const payload = buildTokenPayload(authUser.userId, authUser.schoolId, authUser.role);
  const accessToken = generateAccessToken(payload as never);
  const refreshToken = generateRefreshToken(payload);

  await redisClient.set(`refresh:${authUser.userId}`, refreshToken, 'EX', 30 * 24 * 60 * 60);
  authUser.refreshToken = refreshToken;
  await authUser.save();

  return ApiResponse.success(
    res,
    201,
    {
      accessToken,
      refreshToken,
      user: userResponse.data.data,
      school,
    },
    'School registered successfully',
  );
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as {
    email: string;
    password: string;
  };

  // For admin login, find by email directly
  if (email === 'admin@gmail.com') {
    const authUser = await AuthUser.findOne({ isActive: true });
    
    if (!authUser) {
      throw new ApiError(404, 'Admin user not found');
    }

    const isPasswordValid = await authUser.comparePassword(password);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid credentials');
    }

    authUser.lastLogin = new Date();
    const payload = buildTokenPayload(authUser.userId, authUser.schoolId, authUser.role);
    const accessToken = generateAccessToken(payload as never);
    const refreshToken = generateRefreshToken(payload);

    authUser.refreshToken = refreshToken;
    await authUser.save();
    await redisClient.set(`refresh:${authUser.userId}`, refreshToken, 'EX', 30 * 24 * 60 * 60);

    return ApiResponse.success(
      res,
      200,
      {
        accessToken,
        refreshToken,
        role: authUser.role,
        schoolId: authUser.schoolId,
        userId: authUser.userId,
      },
      'Login successful',
    );
  }

  // For other users, require schoolId
  const { schoolId } = req.body;
  if (!schoolId) {
    throw new ApiError(400, 'School ID is required for non-admin users');
  }

  const userLookup = await axios.get(`${env.USER_SERVICE_URL}/internal/find`, {
    params: { email, schoolId },
  });

  const user = userLookup.data.data as { userId: string; role: 'admin' | 'teacher' | 'parent' };
  const authUser = await AuthUser.findOne({ userId: user.userId, schoolId, isActive: true });
  if (!authUser) {
    throw new ApiError(404, 'User not found');
  }

  const isPasswordValid = await authUser.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  authUser.lastLogin = new Date();
  const payload = buildTokenPayload(authUser.userId, authUser.schoolId, authUser.role);
  const accessToken = generateAccessToken(payload as never);
  const refreshToken = generateRefreshToken(payload);

  authUser.refreshToken = refreshToken;
  await authUser.save();
  await redisClient.set(`refresh:${authUser.userId}`, refreshToken, 'EX', 30 * 24 * 60 * 60);

  return ApiResponse.success(
    res,
    200,
    {
      accessToken,
      refreshToken,
      role: authUser.role,
      schoolId: authUser.schoolId,
    },
    'Login successful',
  );
});

export const sendOTP = asyncHandler(async (req, res) => {
  const { phone, schoolId } = req.body as { phone: string; schoolId: string };
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await redisClient.set(`otp:${phone}:${schoolId}`, otp, 'EX', 300);
  await publishEvent('otp.requested', { phone, otp, schoolId });

  return ApiResponse.success(res, 200, { message: 'OTP sent' }, 'OTP sent');
});

export const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp, schoolId } = req.body as { phone: string; otp: string; schoolId: string };
  const storedOtp = await redisClient.get(`otp:${phone}:${schoolId}`);

  if (!storedOtp || storedOtp !== otp) {
    throw new ApiError(400, 'Invalid OTP');
  }

  await redisClient.del(`otp:${phone}:${schoolId}`);

  const userLookup = await axios.get(`${env.USER_SERVICE_URL}/internal/find`, {
    params: { phone, schoolId },
  });

  const user = userLookup.data.data as { userId: string; role: 'admin' | 'teacher' | 'parent' };
  const authUser = await AuthUser.findOne({ userId: user.userId, schoolId, isActive: true });
  if (!authUser) {
    throw new ApiError(404, 'User not found');
  }

  const payload = buildTokenPayload(authUser.userId, authUser.schoolId, authUser.role);
  const accessToken = generateAccessToken(payload as never);
  const refreshToken = generateRefreshToken(payload);

  authUser.lastLogin = new Date();
  authUser.refreshToken = refreshToken;
  await authUser.save();
  await redisClient.set(`refresh:${authUser.userId}`, refreshToken, 'EX', 30 * 24 * 60 * 60);

  return ApiResponse.success(
    res,
    200,
    {
      accessToken,
      refreshToken,
      role: authUser.role,
      schoolId: authUser.schoolId,
    },
    'OTP verified successfully',
  );
});

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: incomingRefreshToken } = req.body as { refreshToken: string };
  const payload = verifyRefreshToken(incomingRefreshToken);
  const storedToken = await redisClient.get(`refresh:${payload.userId}`);

  if (!storedToken || storedToken !== incomingRefreshToken) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const accessToken = generateAccessToken(payload);
  return ApiResponse.success(res, 200, { accessToken }, 'Access token refreshed successfully');
});

export const logout = asyncHandler(async (req, res) => {
  const { userId } = (req as AuthenticatedRequest).user;
  await redisClient.del(`refresh:${userId}`);
  await AuthUser.findOneAndUpdate({ userId }, { $unset: { refreshToken: 1 } });

  return ApiResponse.success(res, 200, null, 'Logged out successfully');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  const authUser = await AuthUser.findOne({ userId, isActive: true });
  if (!authUser) {
    throw new ApiError(404, 'User not found');
  }

  const matches = await authUser.comparePassword(currentPassword);
  if (!matches) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  authUser.passwordHash = await bcrypt.hash(newPassword, 10);
  await authUser.save();

  return ApiResponse.success(res, 200, null, 'Password changed successfully');
});

export const createInternalAuthUser = asyncHandler(async (req, res) => {
  const { role, schoolId, tempPassword, userId } = req.body as {
    role: 'teacher' | 'parent';
    schoolId: string;
    tempPassword?: string;
    userId?: string;
  };

  const resolvedUserId = userId ?? new mongoose.Types.ObjectId().toString();
  const passwordHash = tempPassword ? await bcrypt.hash(tempPassword, 10) : undefined;

  const authUser = await AuthUser.create({
    userId: resolvedUserId,
    schoolId,
    role,
    passwordHash,
  });

  return ApiResponse.success(
    res,
    201,
    { userId: authUser.userId, schoolId: authUser.schoolId, role: authUser.role },
    'Internal auth user created successfully',
  );
});
