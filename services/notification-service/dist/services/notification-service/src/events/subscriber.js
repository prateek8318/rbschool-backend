"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSubscribers = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
const Notification_1 = require("../models/Notification");
const axios_1 = __importDefault(require("axios"));
const createNotification = async (schoolId, userId, title, message, relatedEntity) => {
    await Notification_1.Notification.create({
        schoolId,
        userId,
        title,
        message,
        type: 'in_app',
        relatedEntity,
    });
};
const initializeSubscribers = async () => {
    const subscriber = new ioredis_1.default(env_1.env.REDIS_URL);
    await subscriber.subscribe('attendance.marked', 'exam.created', 'marks.uploaded', 'fee.overdue', 'otp.requested');
    subscriber.on('message', async (channel, message) => {
        const payload = JSON.parse(message);
        if (channel === 'attendance.marked') {
            const schoolId = String(payload.schoolId);
            const studentIds = payload.absentStudentIds ?? [];
            for (const studentId of studentIds) {
                const response = await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/student-parent/${studentId}`);
                const parent = response.data.data.parent;
                if (parent?.userId) {
                    await createNotification(schoolId, parent.userId, 'Attendance Alert', `Your child was absent today - ${payload.date}`);
                }
            }
        }
        if (channel === 'exam.created') {
            const schoolId = String(payload.schoolId);
            const classIds = payload.classIds ?? [];
            for (const classId of classIds) {
                const studentResponse = await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/students`, {
                    params: { classId, page: 1, limit: 1000 },
                    headers: { 'x-user-id': 'system', 'x-user-role': 'admin', 'x-school-id': schoolId },
                });
                const students = studentResponse.data.data;
                for (const student of students) {
                    await createNotification(schoolId, student.parentUserId, 'New Exam Scheduled', `${String(payload.examName)} scheduled from ${String(payload.startDate)}`, {
                        type: 'exam',
                        id: String(payload.examId),
                    });
                }
            }
        }
        if (channel === 'marks.uploaded') {
            const schoolId = String(payload.schoolId);
            const classId = String(payload.classId);
            const studentResponse = await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/students`, {
                params: { classId, page: 1, limit: 1000 },
                headers: { 'x-user-id': 'system', 'x-user-role': 'admin', 'x-school-id': schoolId },
            });
            const students = studentResponse.data.data;
            for (const student of students) {
                await createNotification(schoolId, student.parentUserId, 'Results Published', `${String(payload.examName)} results are now available`, {
                    type: 'exam',
                    id: String(payload.examId),
                });
            }
        }
        if (channel === 'fee.overdue') {
            const schoolId = String(payload.schoolId);
            const studentIds = payload.overdueStudentIds ?? [];
            for (const studentId of studentIds) {
                const response = await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/student-parent/${studentId}`);
                const parent = response.data.data.parent;
                if (parent?.userId) {
                    await createNotification(schoolId, parent.userId, 'Fee Overdue', 'Fee installment is overdue. Please pay immediately.');
                }
                console.log(`Fee overdue SMS: ${parent?.phone ?? 'unknown'} - Fee installment is overdue. Please pay immediately.`);
            }
        }
        if (channel === 'otp.requested') {
            console.log(`OTP for ${String(payload.phone)}: ${String(payload.otp)}`);
        }
    });
};
exports.initializeSubscribers = initializeSubscribers;
