"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const axios_1 = __importDefault(require("axios"));
const AuthUser_1 = require("../models/AuthUser");
const env_1 = require("../config/env");
const createDefaultAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose_1.default.connect(env_1.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        // Check if admin already exists
        const existingAdmin = await AuthUser_1.AuthUser.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log('Admin user already exists');
            return;
        }
        // Create default school first
        const schoolResponse = await axios_1.default.post(`${env_1.env.SCHOOL_SERVICE_URL}/internal/schools`, {
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
        const userId = new mongoose_1.default.Types.ObjectId().toString();
        const userResponse = await axios_1.default.post(`${env_1.env.USER_SERVICE_URL}/internal/admin`, {
            userId,
            schoolId: school._id,
            name: 'Default Admin',
            email: 'admin@gmail.com',
            phone: '1234567890'
        });
        console.log('Admin user created in user service:', userResponse.data.data);
        // Create auth user with password
        const passwordHash = await bcryptjs_1.default.hash('123456', 10);
        const authUser = await AuthUser_1.AuthUser.create({
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
    }
    catch (error) {
        console.error('Error creating default admin:', error);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
};
// Run the script
createDefaultAdmin();
