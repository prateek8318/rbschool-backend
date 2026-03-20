import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: process.env.PORT || 3007,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/rbschool-admin',
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  
  // Service URLs
  SCHOOL_SERVICE_URL: process.env.SCHOOL_SERVICE_URL || 'http://localhost:3001',
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  ACADEMIC_SERVICE_URL: process.env.ACADEMIC_SERVICE_URL || 'http://localhost:3003',
  ATTENDANCE_SERVICE_URL: process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:3004',
  FEE_SERVICE_URL: process.env.FEE_SERVICE_URL || 'http://localhost:3005',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006',
  
  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
};
