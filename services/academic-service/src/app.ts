import express from 'express';
import morgan from 'morgan';
import { errorMiddleware } from './middleware/error.middleware';
import classRoutes from './routes/class.routes';
import examRoutes from './routes/exam.routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'Academic service healthy', data: { status: 'ok', service: 'academic' } });
});

app.use(classRoutes);
app.use(examRoutes);
app.use(errorMiddleware);

export default app;
