export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, message, 'BAD_REQUEST', details);
export const unauthorized = (message = 'Authentication required') => new AppError(401, message, 'UNAUTHORIZED');
export const forbidden = (message = 'You do not have permission to do this') => new AppError(403, message, 'FORBIDDEN');
export const notFound = (entity = 'Resource') => new AppError(404, `${entity} not found`, 'NOT_FOUND');
export const conflict = (message: string) => new AppError(409, message, 'CONFLICT');
