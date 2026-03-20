import Redis from 'ioredis';
import { env } from '../config/env';
import { Marks } from '../models/Marks';

export const initializeSubscribers = async (): Promise<void> => {
  const subscriber = new Redis(env.REDIS_URL);
  await subscriber.subscribe('student.deleted');

  subscriber.on('message', async (channel, message) => {
    if (channel !== 'student.deleted') {
      return;
    }

    const payload = JSON.parse(message) as { studentId: string };
    await Marks.deleteMany({ studentId: payload.studentId });
  });
};
