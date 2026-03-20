import { redisClient } from '../config/redis';

export const publishEvent = async (channel: string, payload: unknown): Promise<void> => {
  await redisClient.publish(channel, JSON.stringify(payload));
};
