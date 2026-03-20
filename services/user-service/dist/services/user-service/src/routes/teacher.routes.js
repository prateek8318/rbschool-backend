"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const teacher_controller_1 = require("../controllers/teacher.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.get('/teachers', auth_middleware_1.requireServiceAuth, teacher_controller_1.getTeachers);
router.get('/teachers/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, teacher_controller_1.getTeacherById);
router.post('/teachers', auth_middleware_1.requireServiceAuth, [
    (0, express_validator_1.body)('name').isString().notEmpty(),
    (0, express_validator_1.body)('email').isEmail(),
    (0, express_validator_1.body)('phone').isString().notEmpty(),
    (0, express_validator_1.body)('subjects').isArray(),
    (0, express_validator_1.body)('experienceYears').optional().isInt({ min: 0 }),
], error_middleware_1.validateRequest, teacher_controller_1.createTeacher);
router.put('/teachers/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, teacher_controller_1.updateTeacher);
router.delete('/teachers/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, teacher_controller_1.deleteTeacher);
router.put('/teachers/:id/classes', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId(), (0, express_validator_1.body)('classIds').isArray()], error_middleware_1.validateRequest, teacher_controller_1.assignClasses);
router.put('/teachers/:id/assign-classes', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId(), (0, express_validator_1.body)('classIds').isArray()], error_middleware_1.validateRequest, teacher_controller_1.assignClasses);
exports.default = router;
