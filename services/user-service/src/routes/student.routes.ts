import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createStudent,
  deleteStudent,
  exportStudents,
  getMyChildren,
  getParentChildrenInternal,
  getStudentById,
  getStudents,
  updateStudent,
} from '../controllers/student.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

router.get('/students', requireServiceAuth, [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1 })], validateRequest, getStudents);
router.get('/students/export', requireServiceAuth, [query('format').optional().isIn(['csv'])], validateRequest, exportStudents);
router.get('/students/my-children', requireServiceAuth, getMyChildren);
router.get('/students/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, getStudentById);
router.post('/students', requireServiceAuth, [
  body('name').optional().isString().notEmpty(),
  body('firstName').optional().isString().notEmpty(),
  body('lastName').optional().isString(),
  body('dob').isISO8601(),
  body('gender').isIn(['male', 'female', 'other']),
  body('rollNumber').isString().notEmpty(),
  body('admissionNumber').isString().notEmpty(),
  body('parentPhone').isString().notEmpty(),
], validateRequest, createStudent);
router.put('/students/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, updateStudent);
router.delete('/students/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, deleteStudent);

router.get('/internal/parent-children/:parentUserId', getParentChildrenInternal);

export default router;
