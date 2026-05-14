import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3003),
  MONGODB_URI: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  USER_SERVICE_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
