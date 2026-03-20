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
    PORT: zod_1.z.coerce.number().default(3003),
    MONGODB_URI: zod_1.z.string().min(1),
    REDIS_URL: zod_1.z.string().min(1),
    USER_SERVICE_URL: zod_1.z.string().url(),
});
exports.env = envSchema.parse(process.env);
