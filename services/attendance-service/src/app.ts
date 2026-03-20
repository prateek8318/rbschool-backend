import express from 'express';
import morgan from 'morgan';
import attendanceRoutes from './routes/attendance.routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'Attendance service healthy', data: { status: 'ok', service: 'attendance' } });
});

app.use(attendanceRoutes);
app.use(errorMiddleware);

export default app;
