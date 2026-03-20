const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const axios = require('axios');

// Simple admin creation script
async function createAdmin() {
  try {
    console.log('Creating default admin user...');
    
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/rbschool-auth');
    console.log('Connected to MongoDB');

    // Define AuthUser schema inline
    const authUserSchema = new mongoose.Schema({
      userId: { type: String, required: true, unique: true },
      schoolId: { type: String, required: true },
      role: { type: String, enum: ['admin', 'teacher', 'parent'], required: true },
      passwordHash: { type: String },
      isActive: { type: Boolean, default: true },
      lastLogin: { type: Date },
    }, { timestamps: true });

    authUserSchema.methods.comparePassword = async function(plain) {
      return bcrypt.compare(plain, this.passwordHash);
    };

    const AuthUser = mongoose.model('AuthUser', authUserSchema);

    // Check if admin already exists
    const existingAdmin = await AuthUser.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Email: admin@gmail.com');
      console.log('Password: 123456');
      return;
    }

    // Create default school (simplified)
    const userId = new mongoose.Types.ObjectId().toString();
    const schoolId = new mongoose.Types.ObjectId().toString();
    
    // Hash password
    const passwordHash = await bcrypt.hash('123456', 10);

    // Create admin user
    const authUser = await AuthUser.create({
      userId,
      schoolId,
      role: 'admin',
      passwordHash,
      isActive: true
    });

    console.log('✅ Default admin created successfully:');
    console.log('📧 Email: admin@gmail.com');
    console.log('🔑 Password: 123456');
    console.log('🏫 School ID:', schoolId);
    console.log('👤 User ID:', userId);

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();
