"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const http_proxy_middleware_1 = require("http-proxy-middleware");
const env_1 = require("../config/env");
const createServiceProxy = (target) => (0, http_proxy_middleware_1.createProxyMiddleware)({
    target,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    on: {
        error: (_error, _req, res) => {
            const response = res;
            response.writeHead(503, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({
                success: false,
                message: 'Service Unavailable',
            }));
        },
    },
});
const router = (0, express_1.Router)();
router.use('/api/auth', createServiceProxy(env_1.env.AUTH_SERVICE_URL));
router.use('/api/students', createServiceProxy(env_1.env.USER_SERVICE_URL));
router.use('/api/teachers', createServiceProxy(env_1.env.USER_SERVICE_URL));
router.use('/api/parents', createServiceProxy(env_1.env.USER_SERVICE_URL));
router.use('/api/classes', createServiceProxy(env_1.env.ACADEMIC_SERVICE_URL));
router.use('/api/exams', createServiceProxy(env_1.env.ACADEMIC_SERVICE_URL));
router.use('/api/marks', createServiceProxy(env_1.env.ACADEMIC_SERVICE_URL));
router.use('/api/attendance', createServiceProxy(env_1.env.ATTENDANCE_SERVICE_URL));
router.use('/api/fees', createServiceProxy(env_1.env.FEE_SERVICE_URL));
router.use('/api/notifications', createServiceProxy(env_1.env.NOTIFICATION_SERVICE_URL));
router.use('/api/announcements', createServiceProxy(env_1.env.NOTIFICATION_SERVICE_URL));
router.use('/api/schools', createServiceProxy(env_1.env.SCHOOL_SERVICE_URL));
exports.default = router;
