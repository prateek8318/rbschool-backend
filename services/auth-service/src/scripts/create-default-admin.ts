import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { AuthUser } from '../models/AuthUser';
import { env } from '../config/env';

const createDefaultAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await AuthUser.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    // Create default school first
    const schoolResponse = await axios.post(`${env.SCHOOL_SERVICE_URL}/internal/schools`, {
      name: 'RB School Default',
      board: 'CBSE',
      address: 'Default Address',
      phone: '1234567890',
      email: 'admin@gmail.com',
      academicYear: '2024-25'
    });

    const school = schoolResponse.data.data;
    console.log('Default school created:', school);

    // Create admin user in user service
    const userId = new mongoose.Types.ObjectId().toString();
    const userResponse = await axios.post(`${env.USER_SERVICE_URL}/internal/admin`, {
      userId,
      schoolId: school._id,
      name: 'Default Admin',
      email: 'admin@gmail.com',
      phone: '1234567890'
    });

    console.log('Admin user created in user service:', userResponse.data.data);

    // Create auth user with password
    const passwordHash = await bcrypt.hash('123456', 10);
    const authUser = await AuthUser.create({
      userId,
      schoolId: school._id,
      role: 'admin',
      passwordHash,
      isActive: true
    });

    console.log('Default admin created successfully:');
    console.log('Email: admin@gmail.com');
    console.log('Password: 123456');
    console.log('School ID:', school._id);
    console.log('User ID:', userId);

  } catch (error) {
    console.error('Error creating default admin:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// Run the script
createDefaultAdmin();
