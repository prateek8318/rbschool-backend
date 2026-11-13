import { createApp } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './core/db';
import { ensureSuperAdmin } from './modules/auth/bootstrap';
import { registerSubscribers } from './modules/communication/subscribers';
import { startFeeJobs } from './modules/fees/fees.jobs';

const start = async () => {
  if (env.STATIC_OTP) {
    console.warn(`WARNING: STATIC_OTP is set — every OTP is ${env.STATIC_OTP}. Remove it from .env before going live.`);
  }
  await connectDB();
  await ensureSuperAdmin();
  registerSubscribers();
  startFeeJobs();

  const server = createApp().listen(env.PORT, () => {
    console.log(`API ready on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
