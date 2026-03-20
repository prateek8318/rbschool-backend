"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const student_controller_1 = require("../controllers/student.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.get('/students', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.query)('page').optional().isInt({ min: 1 }), (0, express_validator_1.query)('limit').optional().isInt({ min: 1 })], error_middleware_1.validateRequest, student_controller_1.getStudents);
router.get('/students/export', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.query)('format').optional().isIn(['csv'])], error_middleware_1.validateRequest, student_controller_1.exportStudents);
router.get('/students/my-children', auth_middleware_1.requireServiceAuth, student_controller_1.getMyChildren);
router.get('/students/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, student_controller_1.getStudentById);
router.post('/students', auth_middleware_1.requireServiceAuth, [
    (0, express_validator_1.body)('name').optional().isString().notEmpty(),
    (0, express_validator_1.body)('firstName').optional().isString().notEmpty(),
    (0, express_validator_1.body)('lastName').optional().isString(),
    (0, express_validator_1.body)('dob').isISO8601(),
    (0, express_validator_1.body)('gender').isIn(['male', 'female', 'other']),
    (0, express_validator_1.body)('rollNumber').isString().notEmpty(),
    (0, express_validator_1.body)('admissionNumber').isString().notEmpty(),
    (0, express_validator_1.body)('parentPhone').isString().notEmpty(),
], error_middleware_1.validateRequest, student_controller_1.createStudent);
router.put('/students/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, student_controller_1.updateStudent);
router.delete('/students/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, student_controller_1.deleteStudent);
router.get('/internal/parent-children/:parentUserId', student_controller_1.getParentChildrenInternal);
exports.default = router;
