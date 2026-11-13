import { NextFunction, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z, ZodTypeAny } from 'zod';
import { badRequest } from './errors';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and coerces request parts. Parsed values replace the originals,
 * so handlers can trust `req.body` and read query/params via `req.valid`.
 */
export const validate = (schemas: Schemas) => (req: Request, _res: Response, next: NextFunction) => {
  const issues: Array<{ location: string; path: string; message: string }> = [];
  const valid: { body?: unknown; query?: unknown; params?: unknown } = {};

  for (const location of ['params', 'query', 'body'] as const) {
    const schema = schemas[location];
    if (!schema) continue;
    const result = schema.safeParse(req[location] ?? {});
    if (result.success) {
      valid[location] = result.data;
    } else {
      for (const issue of result.error.issues) {
        issues.push({ location, path: issue.path.join('.'), message: issue.message });
      }
    }
  }

  if (issues.length) {
    next(badRequest('Validation failed', issues));
    return;
  }

  if (valid.body !== undefined) req.body = valid.body;
  req.valid = { ...req.valid, ...valid };
  next();
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      valid?: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export const query = <T>(req: Request) => (req.valid?.query ?? req.query) as T;
export const params = <T>(req: Request) => (req.valid?.params ?? req.params) as T;

// ---- Reusable schema pieces ----

export const objectId = z.string().refine((value) => isValidObjectId(value), { message: 'Invalid id' });
export const idParam = z.object({ id: objectId });

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format');

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number');

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().min(1).optional(),
});

export const csvIds = z
  .string()
  .optional()
  .transform((value) => (value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []))
  .refine((ids) => ids.every((id) => isValidObjectId(id)), { message: 'Invalid id in list' });
