import { Router } from 'express';
import { body } from 'express-validator';
import { login } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

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

export default router;
