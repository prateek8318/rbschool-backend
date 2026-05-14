import { Router } from 'express';
import { body } from 'express-validator';
import { applyLeave, getAllLeaves, getMyLeaves, updateLeaveStatus } from '../controllers/leave.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

router.post('/leaves', requireServiceAuth, [
  body('leaveType').notEmpty(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('reason').notEmpty(),
], validateRequest, applyLeave);

router.get('/leaves/my', requireServiceAuth, getMyLeaves);
router.get('/leaves', requireServiceAuth, getAllLeaves);
router.put('/leaves/:id/status', requireServiceAuth, [
  body('status').isIn(['approved', 'rejected']),
], validateRequest, updateLeaveStatus);

export default router;
