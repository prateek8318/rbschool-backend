import Redis from 'ioredis';
import { env } from '../config/env';
import { FeeRecord } from '../models/FeeRecord';

const defaultInstallments = (): Array<{ quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; amount: number; dueDate: string; status: 'pending' }> => {
  const year = new Date().getFullYear();
  return [
    { quarter: 'Q1', amount: 0, dueDate: `${year}-06-15`, status: 'pending' },
    { quarter: 'Q2', amount: 0, dueDate: `${year}-09-15`, status: 'pending' },
    { quarter: 'Q3', amount: 0, dueDate: `${year}-12-15`, status: 'pending' },
    { quarter: 'Q4', amount: 0, dueDate: `${year + 1}-03-15`, status: 'pending' },
  ];
};

export const initializeSubscribers = async (): Promise<void> => {
  const subscriber = new Redis(env.REDIS_URL);
  await subscriber.subscribe('student.created', 'student.deleted');

  subscriber.on('message', async (channel, message) => {
    const payload = JSON.parse(message) as { schoolId: string; studentId: string };
    if (channel === 'student.created') {
      await FeeRecord.updateOne(
        { schoolId: payload.schoolId, studentId: payload.studentId, academicYear: String(new Date().getFullYear()) },
        {
          $setOnInsert: {
            schoolId: payload.schoolId,
            studentId: payload.studentId,
            academicYear: String(new Date().getFullYear()),
            totalAmount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            installments: defaultInstallments(),
          },
        },
        { upsert: true },
      );
    }
    if (channel === 'student.deleted') {
      await FeeRecord.updateMany({ schoolId: payload.schoolId, studentId: payload.studentId }, { $set: { isArchived: true } });
    }
  });
};
