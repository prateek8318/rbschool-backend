import app from './app';
import { connectDB } from './src/config/db';
import { env } from './src/config/env';
import { initializeSubscribers } from './src/events/subscriber';
import { startOverdueChecker } from './src/jobs/overdueChecker';

const start = async (): Promise<void> => {
  await connectDB();
  await initializeSubscribers();
  startOverdueChecker();
  app.listen(env.PORT, () => {
    console.log(`RBSchool fee-service running on port ${env.PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start fee-service', error);
  process.exit(1);
});
