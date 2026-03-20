"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGatewayAuth = void 0;
const shared_1 = require("@rbschool/shared");
const PUBLIC_ROUTES = new Set([
    'POST /api/auth/login',
    'POST /api/auth/send-otp',
    'POST /api/auth/verify-otp',
    'POST /api/auth/register-school',
    'POST /api/auth/refresh',
    'GET /health',
]);
const normalizePath = (path) => path.split('?')[0];
const verifyGatewayAuth = (req, _res, next) => {
    const signature = `${req.method.toUpperCase()} ${normalizePath(req.originalUrl)}`;
    if (PUBLIC_ROUTES.has(signature)) {
        next();
        return;
    }
    const authorization = req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
        next(new shared_1.ApiError(401, 'Unauthorized'));
        return;
    }
    try {
        const payload = (0, shared_1.verifyAccessToken)(authorization.replace('Bearer ', '').trim());
        req.headers['x-user-id'] = payload.userId;
        req.headers['x-user-role'] = payload.role;
        req.headers['x-school-id'] = payload.schoolId;
        req.headers['x-user-name'] = req.header('x-user-name') ?? '';
        next();
    }
    catch (error) {
        next(new shared_1.ApiError(401, 'Unauthorized', [error]));
    }
};
exports.verifyGatewayAuth = verifyGatewayAuth;
