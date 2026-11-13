import compression from 'compression';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { env, isProduction } from './config/env';
import { AppError } from './core/errors';
import { apiRouter } from './routes';

/** CORS_ORIGINS entries may use one leading wildcard, e.g. https://*.devtunnels.ms */
const originPatterns = env.CORS_ORIGINS.map((entry) =>
  entry.includes('*')
    ? new RegExp(`^${entry.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('[a-z0-9-]+')}$`, 'i')
    : entry,
);
const isAllowedOrigin = (origin: string) =>
  originPatterns.some((pattern) => (typeof pattern === 'string' ? pattern === origin : pattern.test(origin)));

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      // Mobile apps send no Origin header and are always allowed.
      origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(isProduction ? 'combined' : 'dev'));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

  app.get('/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ success: dbUp, status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down', uptime: process.uptime() });
  });

  app.use('/api/v1', apiRouter);

  app.use((req, _res, next) => next(new AppError(404, `Route not found: ${req.method} ${req.path}`, 'NOT_FOUND')));

  // Every error becomes { success: false, error: { code, message, details? } }.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
      });
    }

    const err = error as { name?: string; code?: number; keyValue?: Record<string, unknown>; type?: string; message?: string };
    if (err?.code === 11000) {
      const fields = Object.keys(err.keyValue ?? {}).join(', ');
      return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: `Duplicate value for ${fields || 'a unique field'}` } });
    }
    if (err?.name === 'ValidationError' || err?.name === 'CastError') {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message } });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
    }

    console.error('Unhandled error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: isProduction ? 'Something went wrong' : String(err?.message ?? error) },
    });
  });

  return app;
};
