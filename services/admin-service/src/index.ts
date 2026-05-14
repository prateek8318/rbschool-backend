import app from './app';
import { env } from './config/env';
import { connectDB } from './config/db';

const startServer = async () => {
  try {
    // Connect to PostgreSQL
    await connectDB();

    // Start server
    const port = env.PORT;
    app.listen(port, () => {
      console.log(`Admin Service running on port ${port}`);
      console.log(`API Documentation: http://localhost:${port}/api-docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
