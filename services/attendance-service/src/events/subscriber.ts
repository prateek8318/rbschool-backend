import Redis from 'ioredis';
import { env } from '../config/env';
import { Attendance } from '../models/Attendance';

export const initializeSubscribers = async (): Promise<void> => {
  const subscriber = new Redis(env.REDIS_URL);
  await subscriber.subscribe('student.deleted', 'class.deleted');

  subscriber.on('message', async (channel, message) => {
    const payload = JSON.parse(message) as { studentId?: string; classId?: string };
    if (channel === 'student.deleted' && payload.studentId) {
      await Attendance.deleteMany({ studentId: payload.studentId });
    }
    if (channel === 'class.deleted' && payload.classId) {
      await Attendance.deleteMany({ classId: payload.classId });
    }
  });
};
