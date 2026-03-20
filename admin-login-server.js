const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// JWT Secret
const JWT_SECRET = 'your-super-secret-jwt-key';

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/rbschool-auth')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// AuthUser Schema
const authUserSchema = new mongoose.Schema({
  userId: { type: String, required: true },
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
    const adminUser = await AuthUser.findOne({ role: 'admin', isActive: true });
    
    if (!adminUser) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }

    // Verify password
    const isPasswordValid = await adminUser.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    adminUser.lastLogin = new Date();
    await adminUser.save();

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
