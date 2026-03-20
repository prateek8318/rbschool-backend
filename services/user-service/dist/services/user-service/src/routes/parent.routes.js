"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const parent_controller_1 = require("../controllers/parent.controller");
const internal_controller_1 = require("../controllers/internal.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.get('/parents/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, parent_controller_1.getParentById);
router.put('/parents/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, parent_controller_1.updateParent);
router.get('/internal/stats', internal_controller_1.getStats);
router.get('/internal/find', [(0, express_validator_1.query)('schoolId').isString().notEmpty()], error_middleware_1.validateRequest, internal_controller_1.findUser);
router.get('/internal/find-parent', [(0, express_validator_1.query)('phone').isString().notEmpty(), (0, express_validator_1.query)('schoolId').isString().notEmpty()], error_middleware_1.validateRequest, internal_controller_1.findParent);
router.post('/internal/admin', [
    (0, express_validator_1.body)('userId').isString().notEmpty(),
    (0, express_validator_1.body)('schoolId').isString().notEmpty(),
    (0, express_validator_1.body)('name').isString().notEmpty(),
    (0, express_validator_1.body)('email').isEmail(),
    (0, express_validator_1.body)('phone').isString().notEmpty(),
], error_middleware_1.validateRequest, internal_controller_1.createAdminProfile);
router.post('/internal/create-user', [(0, express_validator_1.body)('role').isIn(['teacher', 'parent']), (0, express_validator_1.body)('userId').isString().notEmpty(), (0, express_validator_1.body)('schoolId').isString().notEmpty()], error_middleware_1.validateRequest, internal_controller_1.createUserProfileInternal);
router.get('/internal/teacher-names', internal_controller_1.getTeacherNames);
router.get('/internal/users-by-role', internal_controller_1.getUsersByRole);
router.get('/internal/student-parent/:studentId', internal_controller_1.getStudentParent);
router.get('/internal/student-details', internal_controller_1.getStudentDetailsByIds);
exports.default = router;
