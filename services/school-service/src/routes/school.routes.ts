import { Router } from 'express';
import { body, param } from 'express-validator';
import multer from 'multer';
import { createSchool, getSchool, getSettings, updateSchool, updateSettings, uploadLogo } from '../controllers/school.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/schools', [
  body('name').isString().notEmpty(),
  body('board').isIn(['CBSE', 'ICSE', 'State']),
  body('address').isString().notEmpty(),
  body('phone').isString().notEmpty(),
], validateRequest, createSchool);
router.get('/schools/:id', [param('id').isMongoId()], validateRequest, getSchool);
router.put('/schools/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, updateSchool);
router.get('/schools/:id/settings', [param('id').isMongoId()], validateRequest, getSettings);
router.put('/schools/:id/settings', requireServiceAuth, [param('id').isMongoId()], validateRequest, updateSettings);
router.post('/schools/:id/upload-logo', requireServiceAuth, upload.single('logo'), [param('id').isMongoId()], validateRequest, uploadLogo);

router.post('/internal/schools', [
  body('name').isString().notEmpty(),
  body('board').isIn(['CBSE', 'ICSE', 'State']),
  body('address').isString().notEmpty(),
  body('phone').isString().notEmpty(),
], validateRequest, createSchool);
router.get('/internal/schools/:id', [param('id').isMongoId()], validateRequest, getSchool);

export default router;
