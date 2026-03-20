import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// Simple API Error class
class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    schoolId: string;
    role: 'admin' | 'teacher' | 'parent';
  };
}

export const requireServiceAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    throw new ApiError(401, 'Access token required');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (error) {
    throw new ApiError(401, 'Invalid token');
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user || user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }
  
  next();
};
