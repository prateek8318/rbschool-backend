"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /auth/register-school:
 *   post:
 *     summary: Register a new school with admin user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - schoolName
 *               - board
 *               - address
 *               - phone
 *               - adminName
 *               - adminEmail
 *               - adminPassword
 *             properties:
 *               schoolName:
 *                 type: string
 *                 description: School name
 *               board:
 *                 type: string
 *                 description: School board (CBSE, ICSE, etc.)
 *               address:
 *                 type: string
 *                 description: School address
 *               phone:
 *                 type: string
 *                 description: School phone number
 *               adminName:
 *                 type: string
 *                 description: Admin user name
 *               adminEmail:
 *                 type: string
 *                 format: email
 *                 description: Admin email address
 *               adminPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: Admin password
 *     responses:
 *       201:
 *         description: School registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/auth/register-school', [
    (0, express_validator_1.body)('schoolName').isString().notEmpty(),
    (0, express_validator_1.body)('board').isString().notEmpty(),
    (0, express_validator_1.body)('address').isString().notEmpty(),
    (0, express_validator_1.body)('phone').isString().notEmpty(),
    (0, express_validator_1.body)('adminName').isString().notEmpty(),
    (0, express_validator_1.body)('adminEmail').isEmail(),
    (0, express_validator_1.body)('adminPassword').isLength({ min: 6 }),
], error_middleware_1.validateRequest, auth_controller_1.registerSchool);
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/auth/login', [(0, express_validator_1.body)('email').isEmail(), (0, express_validator_1.body)('password').isString().notEmpty()], error_middleware_1.validateRequest, auth_controller_1.login);
/**
 * @swagger
 * /auth/send-otp:
 *   post:
 *     summary: Send OTP to phone number
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - schoolId
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Phone number
 *               schoolId:
 *                 type: string
 *                 description: School ID
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/auth/send-otp', [(0, express_validator_1.body)('phone').isString().notEmpty(), (0, express_validator_1.body)('schoolId').isString().notEmpty()], error_middleware_1.validateRequest, auth_controller_1.sendOTP);
/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP for phone authentication
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *               - schoolId
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Phone number
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 description: 6-digit OTP
 *               schoolId:
 *                 type: string
 *                 description: School ID
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 */
router.post('/auth/verify-otp', [(0, express_validator_1.body)('phone').isString().notEmpty(), (0, express_validator_1.body)('otp').isLength({ min: 6, max: 6 }), (0, express_validator_1.body)('schoolId').isString().notEmpty()], error_middleware_1.validateRequest, auth_controller_1.verifyOTP);
/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 */
router.post('/auth/refresh', [(0, express_validator_1.body)('refreshToken').isString().notEmpty()], error_middleware_1.validateRequest, auth_controller_1.refreshToken);
/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user and invalidate tokens
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/auth/logout', auth_middleware_1.requireServiceAuth, auth_controller_1.logout);
/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: New password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/auth/change-password', [(0, express_validator_1.body)('currentPassword').isString().notEmpty(), (0, express_validator_1.body)('newPassword').isLength({ min: 6 })], error_middleware_1.validateRequest, auth_middleware_1.requireServiceAuth, auth_controller_1.changePassword);
/**
 * @swagger
 * /internal/create-user:
 *   post:
 *     summary: Create internal user (service-to-service)
 *     tags: [Internal]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *               - schoolId
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [teacher, parent]
 *                 description: User role
 *               schoolId:
 *                 type: string
 *                 description: School ID
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 */
router.post('/internal/create-user', [(0, express_validator_1.body)('role').isIn(['teacher', 'parent']), (0, express_validator_1.body)('schoolId').isString().notEmpty()], error_middleware_1.validateRequest, auth_controller_1.createInternalAuthUser);
exports.default = router;
