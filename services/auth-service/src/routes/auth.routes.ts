import { Router } from 'express';
import { body } from 'express-validator';
import {
  changePassword,
  createInternalAuthUser,
  login,
  logout,
  refreshToken,
  registerSchool,
  sendOTP,
  verifyOTP,
} from '../controllers/auth.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

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
router.post(
  '/auth/register-school',
  [
    body('schoolName').isString().notEmpty(),
    body('board').isString().notEmpty(),
    body('address').isString().notEmpty(),
    body('phone').isString().notEmpty(),
    body('adminName').isString().notEmpty(),
    body('adminEmail').isEmail(),
    body('adminPassword').isLength({ min: 6 }),
  ],
  validateRequest,
  registerSchool,
);

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
router.post(
  '/auth/login',
  [body('email').isEmail(), body('password').isString().notEmpty(), body('schoolId').optional().isString()],
  validateRequest,
  login,
);

/**
 * @swagger
 * /auth/admin/login:
 *   post:
 *     summary: Admin login with email and password only
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Admin email address
 *               password:
 *                 type: string
 *                 description: Admin password
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
router.post(
  '/auth/admin/login',
  [body('email').isEmail(), body('password').isString().notEmpty()],
  validateRequest,
  login,
);

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
router.post(
  '/auth/send-otp',
  [body('phone').isString().notEmpty(), body('schoolId').isString().notEmpty()],
  validateRequest,
  sendOTP,
);

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
router.post(
  '/auth/verify-otp',
  [body('phone').isString().notEmpty(), body('otp').isLength({ min: 6, max: 6 }), body('schoolId').isString().notEmpty()],
  validateRequest,
  verifyOTP,
);

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
router.post('/auth/refresh', [body('refreshToken').isString().notEmpty()], validateRequest, refreshToken);

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
router.post('/auth/logout', requireServiceAuth, logout);

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
router.post(
  '/auth/change-password',
  [body('currentPassword').isString().notEmpty(), body('newPassword').isLength({ min: 6 })],
  validateRequest,
  requireServiceAuth,
  changePassword,
);

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
router.post(
  '/internal/create-user',
  [body('role').isIn(['teacher', 'parent']), body('schoolId').isString().notEmpty()],
  validateRequest,
  createInternalAuthUser,
);

export default router;
