import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  bulkUploadMarks,
  createExam,
  deleteExam,
  getExamResultsSummary,
  getExams,
  getMarksSheet,
  getStudentExamsInternal,
  getStudentResults,
  updateExam,
} from '../controllers/exam.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

router.get('/exams', requireServiceAuth, getExams);
router.post('/exams', requireServiceAuth, [
  body('name').isString().notEmpty(),
  body('type').isIn(['unit', 'midterm', 'final']),
  body('classIds').isArray({ min: 1 }),
  body('subjects').isArray({ min: 1 }),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
], validateRequest, createExam);
router.put('/exams/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, updateExam);
router.delete('/exams/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, deleteExam);
router.post('/exams/:examId/marks/bulk', requireServiceAuth, [param('examId').isMongoId(), body('classId').isString().notEmpty(), body('marks').isArray()], validateRequest, bulkUploadMarks);
router.get('/exams/:id/marks', requireServiceAuth, [param('id').isMongoId()], validateRequest, getMarksSheet);
router.get('/exams/:id/results/summary', requireServiceAuth, [param('id').isMongoId()], validateRequest, getExamResultsSummary);
router.get('/results/student/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, getStudentResults);

router.get('/internal/student-exams/:studentId', getStudentExamsInternal);

export default router;
