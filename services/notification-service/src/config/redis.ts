import Redis from 'ioredis';
import { env } from './env';

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisClient.on('error', (err) => {
  console.warn('Redis Connection Error:', err.message);
});
