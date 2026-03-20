"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const exam_controller_1 = require("../controllers/exam.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.get('/exams', auth_middleware_1.requireServiceAuth, exam_controller_1.getExams);
router.post('/exams', auth_middleware_1.requireServiceAuth, [
    (0, express_validator_1.body)('name').isString().notEmpty(),
    (0, express_validator_1.body)('type').isIn(['unit', 'midterm', 'final']),
    (0, express_validator_1.body)('classIds').isArray({ min: 1 }),
    (0, express_validator_1.body)('subjects').isArray({ min: 1 }),
    (0, express_validator_1.body)('startDate').isISO8601(),
    (0, express_validator_1.body)('endDate').isISO8601(),
], error_middleware_1.validateRequest, exam_controller_1.createExam);
router.put('/exams/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, exam_controller_1.updateExam);
router.delete('/exams/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, exam_controller_1.deleteExam);
router.post('/exams/:examId/marks/bulk', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('examId').isMongoId(), (0, express_validator_1.body)('classId').isString().notEmpty(), (0, express_validator_1.body)('marks').isArray()], error_middleware_1.validateRequest, exam_controller_1.bulkUploadMarks);
router.get('/exams/:id/marks', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, exam_controller_1.getMarksSheet);
router.get('/exams/:id/results/summary', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, exam_controller_1.getExamResultsSummary);
router.get('/results/student/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, exam_controller_1.getStudentResults);
router.get('/internal/student-exams/:studentId', exam_controller_1.getStudentExamsInternal);
exports.default = router;
