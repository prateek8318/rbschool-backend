import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ApiError, ApiResponse } from '@rbschool/shared';

export const validateRequest = (req: Request, _res: Response, next: NextFunction): void => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    next(new ApiError(400, 'Validation failed', result.array()));
    return;
  }

  next();
};

export const errorMiddleware = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response => {
  if (error instanceof ApiError) {
    return ApiResponse.error(res, error.statusCode, error.message, error.errors);
  }

  return ApiResponse.error(res, 500, 'Internal Server Error');
};
