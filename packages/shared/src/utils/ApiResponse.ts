import { Response } from 'express';
import { IApiResponse, IPagination } from '../types';

export class ApiResponse {
  static success<T>(
    res: Response,
    statusCode: number,
    data: T,
    message: string,
    meta?: IPagination,
  ): Response<IApiResponse<T>> {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    });
  }

  static error(
    res: Response,
    statusCode: number,
    message: string,
    errors: unknown[] = [],
  ): Response<{ success: false; message: string; errors?: unknown[] }> {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(errors.length ? { errors } : {}),
    });
  }
}
