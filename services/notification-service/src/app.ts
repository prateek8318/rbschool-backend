import express from 'express';
import morgan from 'morgan';
import { errorMiddleware } from './middleware/error.middleware';
import notificationRoutes from './routes/notification.routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'Notification service healthy', data: { status: 'ok', service: 'notification' } });
});

app.use(notificationRoutes);
app.use(errorMiddleware);

export default app;
