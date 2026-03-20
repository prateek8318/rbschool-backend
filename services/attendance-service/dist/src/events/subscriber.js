"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSubscribers = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
const Attendance_1 = require("../models/Attendance");
const initializeSubscribers = async () => {
    const subscriber = new ioredis_1.default(env_1.env.REDIS_URL);
    await subscriber.subscribe('student.deleted', 'class.deleted');
    subscriber.on('message', async (channel, message) => {
        const payload = JSON.parse(message);
        if (channel === 'student.deleted' && payload.studentId) {
            await Attendance_1.Attendance.deleteMany({ studentId: payload.studentId });
        }
        if (channel === 'class.deleted' && payload.classId) {
            await Attendance_1.Attendance.deleteMany({ classId: payload.classId });
        }
    });
};
exports.initializeSubscribers = initializeSubscribers;
