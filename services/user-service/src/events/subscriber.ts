import Redis from 'ioredis';
import { env } from '../config/env';
import { Student } from '../models/Student';

export const initializeSubscribers = async (): Promise<void> => {
  const subscriber = new Redis(env.REDIS_URL);
  await subscriber.subscribe('class.deleted');

  subscriber.on('message', async (channel, message) => {
    if (channel !== 'class.deleted') {
      return;
    }

    const payload = JSON.parse(message) as { classId: string };
    await Student.updateMany({ classId: payload.classId }, { $set: { classId: null } });
  });
};
