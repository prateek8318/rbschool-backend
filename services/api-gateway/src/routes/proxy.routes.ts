import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { env } from '../config/env';

const createServiceProxy = (target: string) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    on: {
      error: (_error, _req, res) => {
        const response = res as { writeHead: (code: number, headers?: Record<string, string>) => void; end: (body: string) => void };
        response.writeHead(503, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            success: false,
            message: 'Service Unavailable',
          }),
        );
      },
    },
  });

const router = Router();

router.use('/api/auth', createServiceProxy(env.AUTH_SERVICE_URL));
router.use('/api/students', createServiceProxy(env.USER_SERVICE_URL));
router.use('/api/teachers', createServiceProxy(env.USER_SERVICE_URL));
router.use('/api/parents', createServiceProxy(env.USER_SERVICE_URL));
router.use('/api/classes', createServiceProxy(env.ACADEMIC_SERVICE_URL));
router.use('/api/exams', createServiceProxy(env.ACADEMIC_SERVICE_URL));
router.use('/api/marks', createServiceProxy(env.ACADEMIC_SERVICE_URL));
router.use('/api/attendance', createServiceProxy(env.ATTENDANCE_SERVICE_URL));
router.use('/api/fees', createServiceProxy(env.FEE_SERVICE_URL));
router.use('/api/notifications', createServiceProxy(env.NOTIFICATION_SERVICE_URL));
router.use('/api/announcements', createServiceProxy(env.NOTIFICATION_SERVICE_URL));
router.use('/api/schools', createServiceProxy(env.SCHOOL_SERVICE_URL));

export default router;
