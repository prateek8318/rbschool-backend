const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config({ path: './services/auth-service/.env' });
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Same collection that auth-service's AuthUser model uses
const AuthUser = mongoose.model('AuthUser', new mongoose.Schema({}, { strict: false, timestamps: true }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// JWT Secret
const JWT_SECRET = 'your-super-secret-jwt-key';

// Admin Login Endpoint
app.post('/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // For now, only support admin@gmail.com
    if (email !== 'admin@gmail.com') {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Find admin user
    const adminUser = await AuthUser.findOne({ role: 'admin', isActive: true }).lean();
    
    if (!adminUser) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, adminUser.passwordHash);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await AuthUser.updateOne({ _id: adminUser._id }, { lastLogin: new Date() });

    // Generate tokens
    const payload = {
      userId: adminUser.userId,
      schoolId: adminUser.schoolId,
      role: adminUser.role
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        role: adminUser.role,
        schoolId: adminUser.schoolId,
        userId: adminUser.userId,
        email: 'admin@gmail.com'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Admin Login Service is running',
    timestamp: new Date().toISOString()
  });
});

const PORT = 3009;
app.listen(PORT, () => {
  console.log(`🚀 Admin Login Service running on port ${PORT}`);
  console.log(`📧 Admin credentials: admin@gmail.com / 123456`);
  console.log(`🔗 Login endpoint: http://localhost:${PORT}/auth/admin/login`);
});
