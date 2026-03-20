import { Response } from 'express';
import { IApiResponse, IPagination } from '../types';
export declare class ApiResponse {
    static success<T>(res: Response, statusCode: number, data: T, message: string, meta?: IPagination): Response<IApiResponse<T>>;
    static error(res: Response, statusCode: number, message: string, errors?: unknown[]): Response<{
        success: false;
        message: string;
        errors?: unknown[];
    }>;
}
