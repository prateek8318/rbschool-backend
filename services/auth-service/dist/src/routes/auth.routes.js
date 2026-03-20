"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.post('/auth/register-school', [
    (0, express_validator_1.body)('schoolName').isString().notEmpty(),
    (0, express_validator_1.body)('board').isString().notEmpty(),
    (0, express_validator_1.body)('address').isString().notEmpty(),
    (0, express_validator_1.body)('phone').isString().notEmpty(),
    (0, express_validator_1.body)('adminName').isString().notEmpty(),
    (0, express_validator_1.body)('adminEmail').isEmail(),
    (0, express_validator_1.body)('adminPassword').isLength({ min: 6 }),
], error_middleware_1.validateRequest, auth_controller_1.registerSchool);
router.post('/auth/login', [(0, express_validator_1.body)('email').isEmail(), (0, express_validator_1.body)('password').isString().notEmpty(), (0, express_validator_1.body)('schoolId').isString().notEmpty()], error_middleware_1.validateRequest, auth_controller_1.login);
router.post('/auth/send-otp', [(0, express_validator_1.body)('phone').isString().notEmpty(), (0, express_validator_1.body)('schoolId').isString().notEmpty()], error_middleware_1.validateRequest, auth_controller_1.sendOTP);
router.post('/auth/verify-otp', [(0, express_validator_1.body)('phone').isString().notEmpty(), (0, express_validator_1.body)('otp').isLength({ min: 6, max: 6 }), (0, express_validator_1.body)('schoolId').isString().notEmpty()], error_middleware_1.validateRequest, auth_controller_1.verifyOTP);
router.post('/auth/refresh', [(0, express_validator_1.body)('refreshToken').isString().notEmpty()], error_middleware_1.validateRequest, auth_controller_1.refreshToken);
router.post('/auth/logout', auth_middleware_1.requireServiceAuth, auth_controller_1.logout);
router.post('/auth/change-password', [(0, express_validator_1.body)('currentPassword').isString().notEmpty(), (0, express_validator_1.body)('newPassword').isLength({ min: 6 })], error_middleware_1.validateRequest, auth_middleware_1.requireServiceAuth, auth_controller_1.changePassword);
router.post('/internal/create-user', [(0, express_validator_1.body)('role').isIn(['teacher', 'parent']), (0, express_validator_1.body)('schoolId').isString().notEmpty()], error_middleware_1.validateRequest, auth_controller_1.createInternalAuthUser);
router.get('/health', (_req, res) => {
    res.status(200).json({ success: true, message: 'Auth service healthy', data: { status: 'ok', service: 'auth' } });
});
exports.default = router;
