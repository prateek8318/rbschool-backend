"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = exports.validateRequest = void 0;
const express_validator_1 = require("express-validator");
const shared_1 = require("@rbschool/shared");
const validateRequest = (req, _res, next) => {
    const result = (0, express_validator_1.validationResult)(req);
    if (!result.isEmpty()) {
        next(new shared_1.ApiError(400, 'Validation failed', result.array()));
        return;
    }
    next();
};
exports.validateRequest = validateRequest;
const errorMiddleware = (error, _req, res, _next) => {
    if (error instanceof shared_1.ApiError) {
        return shared_1.ApiResponse.error(res, error.statusCode, error.message, error.errors);
    }
    return shared_1.ApiResponse.error(res, 500, 'Internal Server Error');
};
exports.errorMiddleware = errorMiddleware;
