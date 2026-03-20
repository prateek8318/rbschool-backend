import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3007),
  MONGODB_URI: z.string().min(1),
});

export const env = envSchema.parse(process.env);
