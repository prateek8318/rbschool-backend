import { NextFunction, Request, Response } from 'express';
import { ApiError } from '@rbschool/shared';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: 'admin' | 'teacher' | 'parent';
    schoolId: string;
  };
}

export const requireServiceAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const userId = req.header('x-user-id');
  const role = req.header('x-user-role') as 'admin' | 'teacher' | 'parent' | undefined;
  const schoolId = req.header('x-school-id');

  if (!userId || !role || !schoolId) {
    next(new ApiError(401, 'Unauthorized'));
    return;
  }

  (req as AuthenticatedRequest).user = { userId, role, schoolId };
  next();
};
