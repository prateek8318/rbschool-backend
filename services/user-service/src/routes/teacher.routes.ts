import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  assignClasses,
  createTeacher,
  deleteTeacher,
  getTeacherById,
  getTeacherDashboard,
  getTeachers,
  updateTeacher,
} from '../controllers/teacher.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

router.get('/teachers', requireServiceAuth, getTeachers);
router.get('/teachers/dashboard', requireServiceAuth, getTeacherDashboard);
router.get('/teachers/:id', requireServiceAuth, validateRequest, getTeacherById);
router.post('/teachers', requireServiceAuth, [
  body('name').isString().notEmpty(),
  body('email').isEmail(),
  body('phone').isString().notEmpty(),
  body('subjects').isArray(),
  body('experienceYears').optional().isInt({ min: 0 }),
], validateRequest, createTeacher);
router.put('/teachers/:id', requireServiceAuth, validateRequest, updateTeacher);
router.delete('/teachers/:id', requireServiceAuth, validateRequest, deleteTeacher);
router.put('/teachers/:id/classes', requireServiceAuth, [body('classIds').isArray()], validateRequest, assignClasses);
router.put('/teachers/:id/assign-classes', requireServiceAuth, [body('classIds').isArray()], validateRequest, assignClasses);

export default router;
