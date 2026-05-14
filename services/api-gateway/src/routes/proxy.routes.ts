import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { env } from '../config/env';

const createServiceProxy = (target: string, pathPrefix: string) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter: pathPrefix,
    pathRewrite: { [`^${pathPrefix}`]: pathPrefix.replace('/api', '') },
    on: {
      proxyReq: (proxyReq, req: any) => {
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },
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

router.use(createServiceProxy(env.AUTH_SERVICE_URL, '/api/auth'));
router.use(createServiceProxy(env.USER_SERVICE_URL, '/api/students'));
router.use(createServiceProxy(env.USER_SERVICE_URL, '/api/teachers'));
router.use(createServiceProxy(env.USER_SERVICE_URL, '/api/parents'));
router.use(createServiceProxy(env.ACADEMIC_SERVICE_URL, '/api/classes'));
router.use(createServiceProxy(env.ACADEMIC_SERVICE_URL, '/api/exams'));
router.use(createServiceProxy(env.ACADEMIC_SERVICE_URL, '/api/marks'));
router.use(createServiceProxy(env.ATTENDANCE_SERVICE_URL, '/api/attendance'));
router.use(createServiceProxy(env.FEE_SERVICE_URL, '/api/fees'));
router.use(createServiceProxy(env.NOTIFICATION_SERVICE_URL, '/api/notifications'));
router.use(createServiceProxy(env.NOTIFICATION_SERVICE_URL, '/api/announcements'));
router.use(createServiceProxy(env.SCHOOL_SERVICE_URL, '/api/schools'));
router.use(createServiceProxy(env.USER_SERVICE_URL, '/api/leaves'));
router.use(createServiceProxy('http://localhost:3008', '/api/admin'));

export default router;
