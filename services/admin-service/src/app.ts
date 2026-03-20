import express from 'express';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';
import adminRoutes from './routes/admin.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { specs, swaggerUiOptions } from './config/swagger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));

// API Routes
app.use(adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin Service is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use(errorMiddleware);

export default app;
