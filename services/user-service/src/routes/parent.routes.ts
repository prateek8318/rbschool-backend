import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { getParentById, updateParent } from '../controllers/parent.controller';
import {
  createAdminProfile,
  createUserProfileInternal,
  findParent,
  findUser,
  getStats,
  getStudentDetailsByIds,
  getStudentParent,
  getTeacherNames,
  getUsersByRole,
} from '../controllers/internal.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

router.get('/parents/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, getParentById);
router.put('/parents/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, updateParent);

router.get('/internal/stats', getStats);
router.get('/internal/find', [query('schoolId').isString().notEmpty()], validateRequest, findUser);
router.get('/internal/find-parent', [query('phone').isString().notEmpty(), query('schoolId').isString().notEmpty()], validateRequest, findParent);
router.post('/internal/admin', [
  body('userId').isString().notEmpty(),
  body('schoolId').isString().notEmpty(),
  body('name').isString().notEmpty(),
  body('email').isEmail(),
  body('phone').isString().notEmpty(),
], validateRequest, createAdminProfile);
router.post('/internal/create-user', [body('role').isIn(['teacher', 'parent']), body('userId').isString().notEmpty(), body('schoolId').isString().notEmpty()], validateRequest, createUserProfileInternal);
router.get('/internal/teacher-names', getTeacherNames);
router.get('/internal/users-by-role', getUsersByRole);
router.get('/internal/student-parent/:studentId', getStudentParent);
router.get('/internal/student-details', getStudentDetailsByIds);

export default router;
