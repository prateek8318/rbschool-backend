import { Router } from 'express';
import { body } from 'express-validator';
import {
  getDashboardStats,
  getSchools,
  getUsers,
  getAcademicData,
  getAttendanceData,
  getFeeData
} from '../controllers/admin.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSchools:
 *                       type: number
 *                     totalStudents:
 *                       type: number
 *                     totalTeachers:
 *                       type: number
 *                     totalParents:
 *                       type: number
 */
router.get('/admin/dashboard', requireServiceAuth, getDashboardStats);

/**
 * @swagger
 * /admin/schools:
 *   get:
 *     summary: Get all schools
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Schools retrieved successfully
 */
router.get('/admin/schools', requireServiceAuth, getSchools);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users across all schools
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get('/admin/users', requireServiceAuth, getUsers);

/**
 * @swagger
 * /admin/academic:
 *   get:
 *     summary: Get academic data across all schools
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Academic data retrieved successfully
 */
router.get('/admin/academic', requireServiceAuth, getAcademicData);

/**
 * @swagger
 * /admin/attendance:
 *   get:
 *     summary: Get attendance statistics across all schools
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Attendance data retrieved successfully
 */
router.get('/admin/attendance', requireServiceAuth, getAttendanceData);

/**
 * @swagger
 * /admin/fees:
 *   get:
 *     summary: Get fee statistics across all schools
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fee data retrieved successfully
 */
router.get('/admin/fees', requireServiceAuth, getFeeData);

export default router;
