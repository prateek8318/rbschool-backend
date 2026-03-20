"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
class ApiResponse {
    static success(res, statusCode, data, message, meta) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            ...(meta ? { meta } : {}),
        });
    }
    static error(res, statusCode, message, errors = []) {
        return res.status(statusCode).json({
            success: false,
            message,
            ...(errors.length ? { errors } : {}),
        });
    }
}
exports.ApiResponse = ApiResponse;
