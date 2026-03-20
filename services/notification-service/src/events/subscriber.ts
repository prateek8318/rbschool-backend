import Redis from 'ioredis';
import { env } from '../config/env';
import { Notification } from '../models/Notification';
import axios from 'axios';

const createNotification = async (
  schoolId: string,
  userId: string,
  title: string,
  message: string,
  relatedEntity?: { type: string; id: string },
): Promise<void> => {
  await Notification.create({
    schoolId,
    userId,
    title,
    message,
    type: 'in_app',
    relatedEntity,
  });
};

export const initializeSubscribers = async (): Promise<void> => {
  const subscriber = new Redis(env.REDIS_URL);
  await subscriber.subscribe('attendance.marked', 'exam.created', 'marks.uploaded', 'fee.overdue', 'otp.requested');

  subscriber.on('message', async (channel, message) => {
    const payload = JSON.parse(message) as Record<string, unknown>;

    if (channel === 'attendance.marked') {
      const schoolId = String(payload.schoolId);
      const studentIds = (payload.absentStudentIds as string[]) ?? [];
      for (const studentId of studentIds) {
        const response = await axios.get(`${env.USER_SERVICE_URL}/internal/student-parent/${studentId}`);
        const parent = response.data.data.parent as { userId?: string } | null;
        if (parent?.userId) {
          await createNotification(schoolId, parent.userId, 'Attendance Alert', `Your child was absent today - ${payload.date as string}`);
        }
      }
    }

    if (channel === 'exam.created') {
      const schoolId = String(payload.schoolId);
      const classIds = (payload.classIds as string[]) ?? [];
      for (const classId of classIds) {
        const studentResponse = await axios.get(`${env.USER_SERVICE_URL}/students`, {
          params: { classId, page: 1, limit: 1000 },
          headers: { 'x-user-id': 'system', 'x-user-role': 'admin', 'x-school-id': schoolId },
        });
        const students = studentResponse.data.data as Array<{ _id: string; parentUserId: string }>;
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
      const studentResponse = await axios.get(`${env.USER_SERVICE_URL}/students`, {
        params: { classId, page: 1, limit: 1000 },
        headers: { 'x-user-id': 'system', 'x-user-role': 'admin', 'x-school-id': schoolId },
      });
      const students = studentResponse.data.data as Array<{ parentUserId: string }>;
      for (const student of students) {
        await createNotification(schoolId, student.parentUserId, 'Results Published', `${String(payload.examName)} results are now available`, {
          type: 'exam',
          id: String(payload.examId),
        });
      }
    }

    if (channel === 'fee.overdue') {
      const schoolId = String(payload.schoolId);
      const studentIds = (payload.overdueStudentIds as string[]) ?? [];
      for (const studentId of studentIds) {
        const response = await axios.get(`${env.USER_SERVICE_URL}/internal/student-parent/${studentId}`);
        const parent = response.data.data.parent as { userId?: string; phone?: string } | null;
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
