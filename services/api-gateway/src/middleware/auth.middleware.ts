import { NextFunction, Request, Response } from 'express';
import { ApiError, verifyAccessToken } from '@rbschool/shared';

const PUBLIC_ROUTES = new Set<string>([
  'POST /api/auth/login',
  'POST /api/auth/send-otp',
  'POST /api/auth/verify-otp',
  'POST /api/auth/register-school',
  'POST /api/auth/refresh',
  'GET /health',
]);

const normalizePath = (path: string): string => path.split('?')[0];

export const verifyGatewayAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const signature = `${req.method.toUpperCase()} ${normalizePath(req.originalUrl)}`;
  if (PUBLIC_ROUTES.has(signature)) {
    next();
    return;
  }

  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    next(new ApiError(401, 'Unauthorized'));
    return;
  }

  try {
    const payload = verifyAccessToken(authorization.replace('Bearer ', '').trim());
    req.headers['x-user-id'] = payload.userId;
    req.headers['x-user-role'] = payload.role;
    req.headers['x-school-id'] = payload.schoolId;
    req.headers['x-user-name'] = req.header('x-user-name') ?? '';
    next();
  } catch (error) {
    next(new ApiError(401, 'Unauthorized', [error]));
  }
};
