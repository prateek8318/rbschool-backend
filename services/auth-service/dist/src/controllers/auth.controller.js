"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInternalAuthUser = exports.changePassword = exports.logout = exports.refreshToken = exports.verifyOTP = exports.sendOTP = exports.login = exports.registerSchool = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const axios_1 = __importDefault(require("axios"));
const mongoose_1 = __importDefault(require("mongoose"));
const shared_1 = require("@rbschool/shared");
const env_1 = require("../config/env");
const redis_1 = require("../config/redis");
const AuthUser_1 = require("../models/AuthUser");
const publisher_1 = require("../events/publisher");
const buildTokenPayload = (userId, schoolId, role) => ({
    userId,
    schoolId,
    role,
});
exports.registerSchool = (0, shared_1.asyncHandler)(async (req, res) => {
    const { schoolName, board, address, phone, adminName, adminEmail, adminPassword, academicYear, } = req.body;
    const schoolResponse = await axios_1.default.post(`${env_1.env.SCHOOL_SERVICE_URL}/internal/schools`, {
        name: schoolName,
        board,
        address,
        phone,
        email: adminEmail,
        academicYear,
    });
    const school = schoolResponse.data.data;
    const userId = new mongoose_1.default.Types.ObjectId().toString();
    const passwordHash = await bcryptjs_1.default.hash(adminPassword, 10);
    const authUser = await AuthUser_1.AuthUser.create({
        userId,
        schoolId: school._id,
        role: 'admin',
        passwordHash,
    });
    const userResponse = await axios_1.default.post(`${env_1.env.USER_SERVICE_URL}/internal/admin`, {
        userId,
        schoolId: school._id,
        name: adminName,
        email: adminEmail,
        phone,
    });
    const payload = buildTokenPayload(authUser.userId, authUser.schoolId, authUser.role);
    const accessToken = (0, shared_1.generateAccessToken)(payload);
    const refreshToken = (0, shared_1.generateRefreshToken)(payload);
    await redis_1.redisClient.set(`refresh:${authUser.userId}`, refreshToken, 'EX', 30 * 24 * 60 * 60);
    authUser.refreshToken = refreshToken;
    await authUser.save();
    return shared_1.ApiResponse.success(res, 201, {
        accessToken,
        refreshToken,
        user: userResponse.data.data,
        school,
    }, 'School registered successfully');
});
exports.login = (0, shared_1.asyncHandler)(async (req, res) => {
    const { email, password, schoolId } = req.body;
    const userLookup = await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/find`, {
        params: { email, schoolId },
    });
    const user = userLookup.data.data;
    const authUser = await AuthUser_1.AuthUser.findOne({ userId: user.userId, schoolId, isActive: true });
    if (!authUser) {
        throw new shared_1.ApiError(404, 'User not found');
    }
    const isPasswordValid = await authUser.comparePassword(password);
    if (!isPasswordValid) {
        throw new shared_1.ApiError(401, 'Invalid credentials');
    }
    authUser.lastLogin = new Date();
    const payload = buildTokenPayload(authUser.userId, authUser.schoolId, authUser.role);
    const accessToken = (0, shared_1.generateAccessToken)(payload);
    const refreshToken = (0, shared_1.generateRefreshToken)(payload);
    authUser.refreshToken = refreshToken;
    await authUser.save();
    await redis_1.redisClient.set(`refresh:${authUser.userId}`, refreshToken, 'EX', 30 * 24 * 60 * 60);
    return shared_1.ApiResponse.success(res, 200, {
        accessToken,
        refreshToken,
        role: authUser.role,
        schoolId: authUser.schoolId,
    }, 'Login successful');
});
exports.sendOTP = (0, shared_1.asyncHandler)(async (req, res) => {
    const { phone, schoolId } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redis_1.redisClient.set(`otp:${phone}:${schoolId}`, otp, 'EX', 300);
    await (0, publisher_1.publishEvent)('otp.requested', { phone, otp, schoolId });
    return shared_1.ApiResponse.success(res, 200, { message: 'OTP sent' }, 'OTP sent');
});
exports.verifyOTP = (0, shared_1.asyncHandler)(async (req, res) => {
    const { phone, otp, schoolId } = req.body;
    const storedOtp = await redis_1.redisClient.get(`otp:${phone}:${schoolId}`);
    if (!storedOtp || storedOtp !== otp) {
        throw new shared_1.ApiError(400, 'Invalid OTP');
    }
    await redis_1.redisClient.del(`otp:${phone}:${schoolId}`);
    const userLookup = await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/find`, {
        params: { phone, schoolId },
    });
    const user = userLookup.data.data;
    const authUser = await AuthUser_1.AuthUser.findOne({ userId: user.userId, schoolId, isActive: true });
    if (!authUser) {
        throw new shared_1.ApiError(404, 'User not found');
    }
    const payload = buildTokenPayload(authUser.userId, authUser.schoolId, authUser.role);
    const accessToken = (0, shared_1.generateAccessToken)(payload);
    const refreshToken = (0, shared_1.generateRefreshToken)(payload);
    authUser.lastLogin = new Date();
    authUser.refreshToken = refreshToken;
    await authUser.save();
    await redis_1.redisClient.set(`refresh:${authUser.userId}`, refreshToken, 'EX', 30 * 24 * 60 * 60);
    return shared_1.ApiResponse.success(res, 200, {
        accessToken,
        refreshToken,
        role: authUser.role,
        schoolId: authUser.schoolId,
    }, 'OTP verified successfully');
});
exports.refreshToken = (0, shared_1.asyncHandler)(async (req, res) => {
    const { refreshToken: incomingRefreshToken } = req.body;
    const payload = (0, shared_1.verifyRefreshToken)(incomingRefreshToken);
    const storedToken = await redis_1.redisClient.get(`refresh:${payload.userId}`);
    if (!storedToken || storedToken !== incomingRefreshToken) {
        throw new shared_1.ApiError(401, 'Invalid refresh token');
    }
    const accessToken = (0, shared_1.generateAccessToken)(payload);
    return shared_1.ApiResponse.success(res, 200, { accessToken }, 'Access token refreshed successfully');
});
exports.logout = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId } = req.user;
    await redis_1.redisClient.del(`refresh:${userId}`);
    await AuthUser_1.AuthUser.findOneAndUpdate({ userId }, { $unset: { refreshToken: 1 } });
    return shared_1.ApiResponse.success(res, 200, null, 'Logged out successfully');
});
exports.changePassword = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId } = req.user;
    const { currentPassword, newPassword } = req.body;
    const authUser = await AuthUser_1.AuthUser.findOne({ userId, isActive: true });
    if (!authUser) {
        throw new shared_1.ApiError(404, 'User not found');
    }
    const matches = await authUser.comparePassword(currentPassword);
    if (!matches) {
        throw new shared_1.ApiError(400, 'Current password is incorrect');
    }
    authUser.passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
    await authUser.save();
    return shared_1.ApiResponse.success(res, 200, null, 'Password changed successfully');
});
exports.createInternalAuthUser = (0, shared_1.asyncHandler)(async (req, res) => {
    const { role, schoolId, tempPassword, userId } = req.body;
    const resolvedUserId = userId ?? new mongoose_1.default.Types.ObjectId().toString();
    const passwordHash = tempPassword ? await bcryptjs_1.default.hash(tempPassword, 10) : undefined;
    const authUser = await AuthUser_1.AuthUser.create({
        userId: resolvedUserId,
        schoolId,
        role,
        passwordHash,
    });
    return shared_1.ApiResponse.success(res, 201, { userId: authUser.userId, schoolId: authUser.schoolId, role: authUser.role }, 'Internal auth user created successfully');
});
