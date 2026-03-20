"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOverdueChecker = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const publisher_1 = require("../events/publisher");
const FeeRecord_1 = require("../models/FeeRecord");
const startOverdueChecker = () => {
    node_cron_1.default.schedule('0 9 * * *', async () => {
        const today = new Date().toISOString().slice(0, 10);
        const records = await FeeRecord_1.FeeRecord.find({ 'installments.status': 'pending' });
        const overdueStudentIds = new Map();
        for (const record of records) {
            let changed = false;
            record.installments = record.installments.map((item) => {
                if (item.status === 'pending' && item.dueDate < today) {
                    changed = true;
                    overdueStudentIds.set(record.schoolId, [...(overdueStudentIds.get(record.schoolId) ?? []), record.studentId]);
                    return { ...item, status: 'overdue' };
                }
                return item;
            });
            if (changed) {
                await record.save();
            }
        }
        for (const [schoolId, studentIds] of overdueStudentIds.entries()) {
            await (0, publisher_1.publishEvent)('fee.overdue', { schoolId, overdueStudentIds: [...new Set(studentIds)] });
        }
    });
};
exports.startOverdueChecker = startOverdueChecker;
