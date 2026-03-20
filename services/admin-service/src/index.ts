import mongoose from 'mongoose';
import app from './app';
import { env } from './config/env';

const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB');

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
