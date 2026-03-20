import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  createFeeRecord,
  exportFeeReport,
  getAllFees,
  getFeeSummary,
  getInternalSummary,
  getOverdueFees,
  getStudentFee,
  recordPayment,
} from '../controllers/fee.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

router.get('/fees', requireServiceAuth, getAllFees);
router.get('/fees/student/:studentId', requireServiceAuth, [param('studentId').isMongoId()], validateRequest, getStudentFee);
router.post('/fees', requireServiceAuth, [body('studentId').isString().notEmpty(), body('academicYear').isString().notEmpty(), body('totalAmount').isNumeric(), body('installments').isArray({ min: 1 })], validateRequest, createFeeRecord);
router.put('/fees/:id/pay', requireServiceAuth, [param('id').isMongoId(), body('quarter').isIn(['Q1', 'Q2', 'Q3', 'Q4']), body('amountPaid').isNumeric(), body('paymentMode').isIn(['cash', 'online', 'cheque'])], validateRequest, recordPayment);
router.get('/fees/summary', requireServiceAuth, getFeeSummary);
router.get('/fees/overdue', requireServiceAuth, getOverdueFees);
router.get('/fees/report', requireServiceAuth, exportFeeReport);

router.get('/internal/summary', getInternalSummary);

export default router;
