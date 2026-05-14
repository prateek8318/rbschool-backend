import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { ApiError, ApiResponse } from '@rbschool/shared';
import { env } from './config/env';
import { verifyGatewayAuth } from './middleware/auth.middleware';
import { authLimiter, globalLimiter } from './middleware/rateLimit.middleware';
import dashboardRoutes from './routes/dashboard.routes';
import healthRoutes from './routes/health.routes';
import proxyRoutes from './routes/proxy.routes';
import { specs, swaggerUiOptions } from './config/swagger';

const app = express();

app.use(helmet());
app.use(cors({ 
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'], 
  credentials: true 
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(globalLimiter);
app.use('/api/auth', authLimiter);

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));

app.use(verifyGatewayAuth);

app.use(healthRoutes);
app.use(dashboardRoutes);
app.use(proxyRoutes);

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ApiError) {
    return ApiResponse.error(res, error.statusCode, error.message, error.errors);
  }

  return ApiResponse.error(res, 500, 'Internal Server Error');
});

export default app;
