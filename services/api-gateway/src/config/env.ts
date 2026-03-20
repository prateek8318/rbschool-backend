import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  JWT_SECRET: z.string().min(1),
  REDIS_URL: z.string().min(1),
  AUTH_SERVICE_URL: z.string().url(),
  USER_SERVICE_URL: z.string().url(),
  ACADEMIC_SERVICE_URL: z.string().url(),
  ATTENDANCE_SERVICE_URL: z.string().url(),
  FEE_SERVICE_URL: z.string().url(),
  NOTIFICATION_SERVICE_URL: z.string().url(),
  SCHOOL_SERVICE_URL: z.string().url(),
  CORS_ORIGIN: z.string().min(1),
});

export const env = envSchema.parse(process.env);
