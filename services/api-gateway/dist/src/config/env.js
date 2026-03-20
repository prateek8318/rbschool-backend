"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().default(8000),
    JWT_SECRET: zod_1.z.string().min(1),
    REDIS_URL: zod_1.z.string().min(1),
    AUTH_SERVICE_URL: zod_1.z.string().url(),
    USER_SERVICE_URL: zod_1.z.string().url(),
    ACADEMIC_SERVICE_URL: zod_1.z.string().url(),
    ATTENDANCE_SERVICE_URL: zod_1.z.string().url(),
    FEE_SERVICE_URL: zod_1.z.string().url(),
    NOTIFICATION_SERVICE_URL: zod_1.z.string().url(),
    SCHOOL_SERVICE_URL: zod_1.z.string().url(),
    CORS_ORIGIN: zod_1.z.string().min(1),
});
exports.env = envSchema.parse(process.env);
