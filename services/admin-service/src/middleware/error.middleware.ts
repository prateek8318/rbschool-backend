import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// Simple API Error class
class ApiError extends Error {
  public errors?: any;
  constructor(public statusCode: number, message: string, errors?: any) {
    super(message);
    this.errors = errors;
  }
}

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    throw new ApiError(400, errorMessages.join(', '));
  }
  next();
};

export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors })
    });
  }

  console.error('Error:', err);
  
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
};
