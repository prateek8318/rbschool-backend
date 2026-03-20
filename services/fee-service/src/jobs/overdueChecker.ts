import cron from 'node-cron';
import { publishEvent } from '../events/publisher';
import { FeeRecord } from '../models/FeeRecord';

export const startOverdueChecker = (): void => {
  cron.schedule('0 9 * * *', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const records = await FeeRecord.find({ 'installments.status': 'pending' });
    const overdueStudentIds = new Map<string, string[]>();

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
      await publishEvent('fee.overdue', { schoolId, overdueStudentIds: [...new Set(studentIds)] });
    }
  });
};
