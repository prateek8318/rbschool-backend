"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSubscribers = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
const FeeRecord_1 = require("../models/FeeRecord");
const defaultInstallments = () => {
    const year = new Date().getFullYear();
    return [
        { quarter: 'Q1', amount: 0, dueDate: `${year}-06-15`, status: 'pending' },
        { quarter: 'Q2', amount: 0, dueDate: `${year}-09-15`, status: 'pending' },
        { quarter: 'Q3', amount: 0, dueDate: `${year}-12-15`, status: 'pending' },
        { quarter: 'Q4', amount: 0, dueDate: `${year + 1}-03-15`, status: 'pending' },
    ];
};
const initializeSubscribers = async () => {
    const subscriber = new ioredis_1.default(env_1.env.REDIS_URL);
    await subscriber.subscribe('student.created', 'student.deleted');
    subscriber.on('message', async (channel, message) => {
        const payload = JSON.parse(message);
        if (channel === 'student.created') {
            await FeeRecord_1.FeeRecord.updateOne({ schoolId: payload.schoolId, studentId: payload.studentId, academicYear: String(new Date().getFullYear()) }, {
                $setOnInsert: {
                    schoolId: payload.schoolId,
                    studentId: payload.studentId,
                    academicYear: String(new Date().getFullYear()),
                    totalAmount: 0,
                    paidAmount: 0,
                    pendingAmount: 0,
                    installments: defaultInstallments(),
                },
            }, { upsert: true });
        }
        if (channel === 'student.deleted') {
            await FeeRecord_1.FeeRecord.updateMany({ schoolId: payload.schoolId, studentId: payload.studentId }, { $set: { isArchived: true } });
        }
    });
};
exports.initializeSubscribers = initializeSubscribers;
