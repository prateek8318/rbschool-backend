import app from './app';
import { connectDB } from './src/config/db';
import { env } from './src/config/env';
import { initializeSubscribers } from './src/events/subscriber';

const start = async (): Promise<void> => {
  await connectDB();
  await initializeSubscribers();
  app.listen(env.PORT, () => {
    console.log(`RBSchool academic-service running on port ${env.PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start academic-service', error);
  process.exit(1);
});
