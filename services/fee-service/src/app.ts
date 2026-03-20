import express from 'express';
import morgan from 'morgan';
import { errorMiddleware } from './middleware/error.middleware';
import feeRoutes from './routes/fee.routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'Fee service healthy', data: { status: 'ok', service: 'fee' } });
});

app.use(feeRoutes);
app.use(errorMiddleware);

export default app;
