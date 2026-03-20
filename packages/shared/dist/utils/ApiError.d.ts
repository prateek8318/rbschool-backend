export declare class ApiError extends Error {
    statusCode: number;
    errors: unknown[];
    constructor(statusCode: number, message: string, errors?: unknown[]);
}
