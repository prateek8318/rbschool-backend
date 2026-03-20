import express from 'express';
import morgan from 'morgan';
import { errorMiddleware } from './middleware/error.middleware';
import schoolRoutes from './routes/school.routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'School service healthy', data: { status: 'ok', service: 'school' } });
});

app.use(schoolRoutes);
app.use(errorMiddleware);

export default app;
