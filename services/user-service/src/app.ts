import express from 'express';
import morgan from 'morgan';
import { errorMiddleware } from './middleware/error.middleware';
import parentRoutes from './routes/parent.routes';
import studentRoutes from './routes/student.routes';
import teacherRoutes from './routes/teacher.routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'User service healthy', data: { status: 'ok', service: 'user' } });
});

app.use(studentRoutes);
app.use(teacherRoutes);
app.use(parentRoutes);
app.use(errorMiddleware);

export default app;
