import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  addHoliday,
  bulkMarkAttendance,
  exportAttendanceReport,
  getAttendanceByClass,
  getAttendanceReport,
  getHolidays,
  getInternalAdminSummary,
  getInternalToday,
  getLowAttendance,
  getStudentMonthly,
  getStudentSummary,
  getTeacherToday,
  getTodayOverview,
} from '../controllers/attendance.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

router.post('/attendance/bulk', requireServiceAuth, [body('classId').isString().notEmpty(), body('date').isString().notEmpty(), body('records').isArray({ min: 1 })], validateRequest, bulkMarkAttendance);
router.get('/attendance', requireServiceAuth, [query('classId').isString().notEmpty(), query('date').isString().notEmpty()], validateRequest, getAttendanceByClass);
router.get('/attendance/student/:id', requireServiceAuth, [param('id').isMongoId(), query('month').isInt({ min: 1, max: 12 }), query('year').isInt({ min: 2000 })], validateRequest, getStudentMonthly);
router.get('/attendance/report', requireServiceAuth, [query('classId').isString().notEmpty(), query('from').isString().notEmpty(), query('to').isString().notEmpty()], validateRequest, getAttendanceReport);
router.get('/attendance/report/export', requireServiceAuth, [query('classId').isString().notEmpty(), query('from').isString().notEmpty(), query('to').isString().notEmpty(), query('format').optional().isIn(['csv'])], validateRequest, exportAttendanceReport);
router.get('/attendance/summary/:studentId', requireServiceAuth, [param('studentId').isMongoId()], validateRequest, getStudentSummary);
router.get('/attendance/today-overview', requireServiceAuth, getTodayOverview);
router.get('/attendance/low-attendance', requireServiceAuth, [query('threshold').optional().isFloat({ min: 0, max: 100 })], validateRequest, getLowAttendance);
router.get('/attendance/holidays', requireServiceAuth, [query('month').isInt({ min: 1, max: 12 }), query('year').isInt({ min: 2000 })], validateRequest, getHolidays);
router.post('/attendance/holidays', requireServiceAuth, [body('date').isString().notEmpty(), body('name').isString().notEmpty(), body('type').isIn(['national', 'state', 'school'])], validateRequest, addHoliday);

router.get('/internal/today', getInternalToday);
router.get('/internal/admin-summary', getInternalAdminSummary);
router.get('/internal/summary/:studentId', getStudentSummary);
router.get('/internal/teacher-today/:teacherId', getTeacherToday);

export default router;
