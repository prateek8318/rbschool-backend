"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const express_1 = require("express");
const shared_1 = require("@rbschool/shared");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
const buildHeaders = (headers) => ({
    'x-user-id': typeof headers['x-user-id'] === 'string' ? headers['x-user-id'] : '',
    'x-user-role': typeof headers['x-user-role'] === 'string' ? headers['x-user-role'] : '',
    'x-school-id': typeof headers['x-school-id'] === 'string' ? headers['x-school-id'] : '',
    'x-user-name': typeof headers['x-user-name'] === 'string' ? headers['x-user-name'] : '',
});
const ensureRole = (expectedRole, currentRole) => {
    if (currentRole !== expectedRole) {
        throw new shared_1.ApiError(403, 'Forbidden');
    }
};
const settledValue = (result, fallback) => result.status === 'fulfilled' ? result.value.data.data : fallback;
router.get('/api/dashboard/admin', (0, shared_1.asyncHandler)(async (req, res) => {
    ensureRole('admin', req.header('x-user-role') ?? undefined);
    const headers = buildHeaders(req.headers);
    const [userStats, attendanceStats, feeSummary] = await Promise.allSettled([
        axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/stats`, { headers }),
        axios_1.default.get(`${env_1.env.ATTENDANCE_SERVICE_URL}/internal/admin-summary`, { headers }),
        axios_1.default.get(`${env_1.env.FEE_SERVICE_URL}/internal/summary`, { headers }),
    ]);
    const users = settledValue(userStats, { studentCount: 0, teacherCount: 0 });
    const attendance = settledValue(attendanceStats, {
        attendanceToday: { percentage: 0, present: 0, absent: 0 },
        weeklyAttendance: [],
        recentActivity: [],
    });
    const fees = settledValue(feeSummary, { collected: 0, pending: 0, total: 0 });
    return shared_1.ApiResponse.success(res, 200, {
        totalStudents: users.studentCount,
        totalTeachers: users.teacherCount,
        attendanceToday: attendance.attendanceToday,
        feeSummary: fees,
        weeklyAttendance: attendance.weeklyAttendance,
        recentActivity: attendance.recentActivity,
    }, 'Admin dashboard fetched successfully');
}));
router.get('/api/dashboard/teacher', (0, shared_1.asyncHandler)(async (req, res) => {
    const userId = req.header('x-user-id') ?? '';
    ensureRole('teacher', req.header('x-user-role') ?? undefined);
    const headers = buildHeaders(req.headers);
    const [classes, todayStatus] = await Promise.all([
        axios_1.default.get(`${env_1.env.ACADEMIC_SERVICE_URL}/internal/teacher-classes/${userId}`, { headers }),
        axios_1.default.get(`${env_1.env.ATTENDANCE_SERVICE_URL}/internal/teacher-today/${userId}`, { headers }),
    ]);
    return shared_1.ApiResponse.success(res, 200, {
        assignedClasses: classes.data.data,
        attendanceStatus: todayStatus.data.data,
    }, 'Teacher dashboard fetched successfully');
}));
router.get('/api/dashboard/parent', (0, shared_1.asyncHandler)(async (req, res) => {
    const userId = req.header('x-user-id') ?? '';
    ensureRole('parent', req.header('x-user-role') ?? undefined);
    const headers = buildHeaders(req.headers);
    const childrenResponse = await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/parent-children/${userId}`, {
        headers,
    });
    const children = childrenResponse.data.data;
    const childSummaries = await Promise.all(children.map(async (child) => {
        const [attendance, fee] = await Promise.all([
            axios_1.default.get(`${env_1.env.ATTENDANCE_SERVICE_URL}/internal/summary/${child._id}`, { headers }),
            axios_1.default.get(`${env_1.env.FEE_SERVICE_URL}/fees/student/${child._id}`, { headers }),
        ]);
        return {
            ...child,
            attendancePercentage: attendance.data.data.allTime.percentage,
            feePending: fee.data.data.pendingAmount,
        };
    }));
    return shared_1.ApiResponse.success(res, 200, { children: childSummaries }, 'Parent dashboard fetched successfully');
}));
exports.default = router;
