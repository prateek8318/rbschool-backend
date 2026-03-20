import { Router } from 'express';
import { body, param } from 'express-validator';
import { createClass, deleteClass, getClassStudents, getClasses, updateClass } from '../controllers/class.controller';
import { getClassInternal, getClassesByIdsInternal, getTeacherClassesInternal } from '../controllers/exam.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

router.get('/classes', requireServiceAuth, getClasses);
router.post('/classes', requireServiceAuth, [body('name').isString().notEmpty(), body('section').isString().notEmpty(), body('academicYear').isString().notEmpty(), body('subjects').isArray()], validateRequest, createClass);
router.put('/classes/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, updateClass);
router.delete('/classes/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, deleteClass);
router.get('/classes/:id/students', requireServiceAuth, [param('id').isMongoId()], validateRequest, getClassStudents);

router.get('/internal/class/:id', getClassInternal);
router.get('/internal/teacher-classes/:teacherId', getTeacherClassesInternal);
router.get('/internal/classes-by-ids', getClassesByIdsInternal);

export default router;
