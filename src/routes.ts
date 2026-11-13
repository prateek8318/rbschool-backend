import { Router } from 'express';
import { authenticate } from './core/auth';
import academicsRoutes from './modules/academics/academics.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import authRoutes from './modules/auth/auth.routes';
import { announcementsRouter, notificationsRouter } from './modules/communication/communication.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import examsRoutes from './modules/exams/exams.routes';
import feesRoutes from './modules/fees/fees.routes';
import institutionRoutes from './modules/institutions/institution.routes';
import leavesRoutes from './modules/leaves/leaves.routes';
import { guardiansRouter, meRouter, staffRouter, studentsRouter } from './modules/people/people.routes';
import platformRoutes from './modules/platform/platform.routes';

/** Every API route, mounted under /api/v1. */
export const apiRouter = Router();

// Public (login, register, refresh) + a few authenticated account routes inside.
apiRouter.use('/auth', authRoutes);

// Everything below needs a valid access token.
apiRouter.use(authenticate);

apiRouter.use('/platform', platformRoutes);
apiRouter.use('/institution', institutionRoutes);
apiRouter.use('/academics', academicsRoutes);
apiRouter.use('/students', studentsRouter);
apiRouter.use('/staff', staffRouter);
apiRouter.use('/guardians', guardiansRouter);
apiRouter.use('/me', meRouter);
apiRouter.use('/attendance', attendanceRoutes);
apiRouter.use('/exams', examsRoutes);
apiRouter.use('/fees', feesRoutes);
apiRouter.use('/announcements', announcementsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/leaves', leavesRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
