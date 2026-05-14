import { PrismaClient } from '@prisma/client';
import { env } from './env';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL as string,
    },
  },
});

export const connectDB = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('Connected to PostgreSQL (Supabase) via Prisma');
  } catch (error) {
    console.error('PostgreSQL connection error:', error);
    process.exit(1);
  }
};
