import mongoose from 'mongoose';
import { env } from '../config/env';

mongoose.set('strictQuery', true);

export const connectDB = async (): Promise<void> => {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log(`MongoDB connected (database: ${mongoose.connection.name})`);
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
};
