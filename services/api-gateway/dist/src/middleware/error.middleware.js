"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const shared_1 = require("@rbschool/shared");
const errorMiddleware = (err, _req, res, _next) => {
    const statusCode = err instanceof shared_1.ApiError ? err.statusCode : 500;
    const errors = err instanceof shared_1.ApiError ? err.errors : [];
    res.status(statusCode).json(new shared_1.ApiResponse(statusCode, { errors }, err.message || "Internal server error"));
};
exports.errorMiddleware = errorMiddleware;
