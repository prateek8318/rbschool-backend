"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const mongoose_1 = __importStar(require("mongoose"));
const redis_1 = require("../config/redis");
const authUserSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true, trim: true },
    schoolId: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'teacher', 'parent'], required: true },
    passwordHash: { type: String },
    refreshToken: { type: String },
    otp: { type: String },
    otpExpiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
}, {
    timestamps: true,
});
authUserSchema.methods.comparePassword = async function comparePassword(plain) {
    if (!this.passwordHash) {
        return false;
    }
    return bcryptjs_1.default.compare(plain, this.passwordHash);
};
authUserSchema.methods.generateOTP = async function generateOTP() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    this.otp = otp;
    this.otpExpiresAt = expiresAt;
    await this.save();
    await redis_1.redisClient.set(`otp-user:${this.userId}`, otp, 'EX', 300);
    return otp;
};
exports.AuthUser = mongoose_1.default.model('AuthUser', authUserSchema);
