import express from 'express';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/auth.routes';
import adminLoginRoutes from './routes/admin-login';
import { errorMiddleware } from './middleware/error.middleware';
import { specs, swaggerUiOptions } from './config/swagger';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));

// API Routes
app.use(authRoutes);
app.use(adminLoginRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Auth Service is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use(errorMiddleware);

export default app;
