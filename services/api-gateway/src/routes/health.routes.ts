import axios from 'axios';
import { Router } from 'express';
import { ApiResponse, asyncHandler } from '@rbschool/shared';
import { env } from '../config/env';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const services = {
      auth: env.AUTH_SERVICE_URL,
      user: env.USER_SERVICE_URL,
      academic: env.ACADEMIC_SERVICE_URL,
      attendance: env.ATTENDANCE_SERVICE_URL,
      fee: env.FEE_SERVICE_URL,
      notification: env.NOTIFICATION_SERVICE_URL,
      school: env.SCHOOL_SERVICE_URL,
    };

    const results = await Promise.all(
      Object.entries(services).map(async ([key, url]) => {
        try {
          await axios.get(`${url}/health`, { timeout: 3000 });
          return [key, 'ok'] as const;
        } catch {
          return [key, 'down'] as const;
        }
      }),
    );

    return ApiResponse.success(
      res,
      200,
      {
        gateway: 'ok',
        services: Object.fromEntries(results),
      },
      'Gateway health fetched successfully',
    );
  }),
);

export default router;
