"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const morgan_1 = __importDefault(require("morgan"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, morgan_1.default)('dev'));
app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, message: 'Attendance service healthy', data: { status: 'ok', service: 'attendance' } });
});
app.use(attendance_routes_1.default);
app.use(error_middleware_1.errorMiddleware);
exports.default = app;
