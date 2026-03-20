"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceHealthTargets = exports.serviceRegistry = void 0;
const env_1 = require("./env");
exports.serviceRegistry = {
    auth: env_1.env.AUTH_SERVICE_URL,
    users: env_1.env.USER_SERVICE_URL,
    students: env_1.env.USER_SERVICE_URL,
    teachers: env_1.env.USER_SERVICE_URL,
    classes: env_1.env.ACADEMIC_SERVICE_URL,
    exams: env_1.env.ACADEMIC_SERVICE_URL,
    marks: env_1.env.ACADEMIC_SERVICE_URL,
    attendance: env_1.env.ATTENDANCE_SERVICE_URL,
    fees: env_1.env.FEE_SERVICE_URL,
    notifications: env_1.env.NOTIFICATION_SERVICE_URL,
    announcements: env_1.env.NOTIFICATION_SERVICE_URL,
    schools: env_1.env.SCHOOL_SERVICE_URL,
};
exports.serviceHealthTargets = {
    auth: `${env_1.env.AUTH_SERVICE_URL}/health`,
    users: `${env_1.env.USER_SERVICE_URL}/health`,
    academic: `${env_1.env.ACADEMIC_SERVICE_URL}/health`,
    attendance: `${env_1.env.ATTENDANCE_SERVICE_URL}/health`,
    fee: `${env_1.env.FEE_SERVICE_URL}/health`,
    notifications: `${env_1.env.NOTIFICATION_SERVICE_URL}/health`,
    school: `${env_1.env.SCHOOL_SERVICE_URL}/health`,
};
