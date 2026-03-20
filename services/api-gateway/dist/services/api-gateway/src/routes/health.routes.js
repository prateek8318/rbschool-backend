"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const express_1 = require("express");
const shared_1 = require("@rbschool/shared");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
router.get('/health', (0, shared_1.asyncHandler)(async (_req, res) => {
    const services = {
        auth: env_1.env.AUTH_SERVICE_URL,
        user: env_1.env.USER_SERVICE_URL,
        academic: env_1.env.ACADEMIC_SERVICE_URL,
        attendance: env_1.env.ATTENDANCE_SERVICE_URL,
        fee: env_1.env.FEE_SERVICE_URL,
        notification: env_1.env.NOTIFICATION_SERVICE_URL,
        school: env_1.env.SCHOOL_SERVICE_URL,
    };
    const results = await Promise.all(Object.entries(services).map(async ([key, url]) => {
        try {
            await axios_1.default.get(`${url}/health`, { timeout: 3000 });
            return [key, 'ok'];
        }
        catch {
            return [key, 'down'];
        }
    }));
    return shared_1.ApiResponse.success(res, 200, {
        gateway: 'ok',
        services: Object.fromEntries(results),
    }, 'Gateway health fetched successfully');
}));
exports.default = router;
