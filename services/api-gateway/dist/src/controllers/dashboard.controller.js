"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminDashboard = void 0;
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@rbschool/shared");
const env_1 = require("../config/env");
const forwardHeaders = (req) => ({
    "x-user-id": String(req.headers["x-user-id"] ?? ""),
    "x-user-role": String(req.headers["x-user-role"] ?? ""),
    "x-school-id": String(req.headers["x-school-id"] ?? ""),
});
exports.getAdminDashboard = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const headers = forwardHeaders(req);
    const [userSummary, attendanceSummary, feeSummary] = await Promise.allSettled([
        axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/students/summary/counts`, { headers }),
        axios_1.default.get(`${env_1.env.ATTENDANCE_SERVICE_URL}/attendance/today-overview`, { headers }),
        axios_1.default.get(`${env_1.env.FEE_SERVICE_URL}/fees/summary`, { headers }),
    ]);
    const response = {
        users: userSummary.status === "fulfilled"
            ? userSummary.value.data.data
            : { error: userSummary.reason?.message ?? "Unavailable" },
        attendance: attendanceSummary.status === "fulfilled"
            ? attendanceSummary.value.data.data
            : { error: attendanceSummary.reason?.message ?? "Unavailable" },
        fees: feeSummary.status === "fulfilled"
            ? feeSummary.value.data.data
            : { error: feeSummary.reason?.message ?? "Unavailable" },
    };
    res.status(200).json(new shared_1.ApiResponse(200, response, "Admin dashboard aggregated"));
});
