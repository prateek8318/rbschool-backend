import axios from 'axios';
import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { env } from '../config/env';
import { publishEvent } from '../events/publisher';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { FeeRecord } from '../models/FeeRecord';

const monthName = (value: number): string => String(value).padStart(2, '0');

const csvEscape = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

export const getAllFees = asyncHandler(async (req, res) => {
  const { userId, role, schoolId } = (req as AuthenticatedRequest).user;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  let studentIds: string[] | null = null;

  if (req.query.classId) {
    const studentResponse = await axios.get(`${env.USER_SERVICE_URL}/students`, {
      params: { classId: req.query.classId, page: 1, limit: 1000 },
      headers: { 'x-user-id': userId, 'x-user-role': role, 'x-school-id': schoolId },
    });
    studentIds = (studentResponse.data.data as Array<{ _id: string }>).map((student) => student._id);
  }

  const query: Record<string, unknown> = { schoolId, isArchived: false };
  if (studentIds) query.studentId = { $in: studentIds };

  let records = await FeeRecord.find(query).sort({ createdAt: -1 });
  if (req.query.status) {
    const status = String(req.query.status);
    records = records.filter((record) => record.installments.some((item) => item.status === status));
  }

  const studentDetails = records.length
    ? (await axios.get(`${env.USER_SERVICE_URL}/internal/student-details`, {
        params: { ids: records.map((record) => record.studentId).join(',') },
      })).data.data as Array<{ _id: string; name: string; classId?: string }>
    : [];
  const studentMap = new Map(studentDetails.map((student) => [student._id, student]));

  let merged = records.map((record) => ({ ...record.toObject(), student: studentMap.get(record.studentId) ?? null }));
  if (req.query.search) {
    const search = String(req.query.search).toLowerCase();
    merged = merged.filter((record) => (record.student?.name ?? '').toLowerCase().includes(search));
  }

  const start = (page - 1) * limit;
  const paged = merged.slice(start, start + limit);

  return ApiResponse.success(res, 200, paged, 'Fee records fetched successfully', {
    page,
    limit,
    total: merged.length,
    totalPages: Math.ceil(merged.length / limit) || 1,
  });
});

export const getStudentFee = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const fee = await FeeRecord.findOne({ schoolId, studentId: req.params.studentId, isArchived: false }).sort({ createdAt: -1 });
  if (!fee) throw new ApiError(404, 'Fee record not found');
  fee.pendingAmount = Math.max(0, fee.totalAmount - fee.paidAmount);
  await fee.save();
  return ApiResponse.success(res, 200, fee, 'Student fee fetched successfully');
});

export const createFeeRecord = asyncHandler(async (req, res) => {
  const { role, schoolId } = (req as AuthenticatedRequest).user;
  if (role !== 'admin') throw new ApiError(403, 'Only admin can create fee records');

  const { studentId, academicYear, totalAmount, installments } = req.body as {
    studentId: string;
    academicYear: string;
    totalAmount: number;
    installments: Array<{ quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; amount: number; dueDate: string }>;
  };

  const exists = await FeeRecord.findOne({ schoolId, studentId, academicYear });
  if (exists) throw new ApiError(409, 'Fee record already exists');

  const fee = await FeeRecord.create({
    schoolId,
    studentId,
    academicYear,
    totalAmount,
    paidAmount: 0,
    pendingAmount: totalAmount,
    installments: installments.map((item) => ({ ...item, status: 'pending' })),
  });

  return ApiResponse.success(res, 201, fee, 'Fee record created successfully');
});

export const recordPayment = asyncHandler(async (req, res) => {
  const { userId, schoolId } = (req as AuthenticatedRequest).user;
  const { quarter, amountPaid, paymentMode, transactionId } = req.body as {
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    amountPaid: number;
    paymentMode: 'cash' | 'online' | 'cheque';
    transactionId?: string;
  };

  const fee = await FeeRecord.findOne({ _id: req.params.id, schoolId, isArchived: false });
  if (!fee) throw new ApiError(404, 'Fee record not found');
  const installment = fee.installments.find((item) => item.quarter === quarter);
  if (!installment) throw new ApiError(404, 'Installment not found');

  installment.paymentMode = paymentMode;
  installment.transactionId = transactionId;
  installment.recordedBy = userId;
  installment.paidDate = new Date().toISOString();
  installment.status = installment.amount > amountPaid ? 'pending' : 'paid';

  fee.paidAmount += amountPaid;
  fee.pendingAmount = Math.max(0, fee.totalAmount - fee.paidAmount);
  if (fee.pendingAmount <= 0) {
    fee.installments = fee.installments.map((item) => ({ ...item, status: 'paid', paidDate: item.paidDate ?? new Date().toISOString() }));
  }
  await fee.save();

  await publishEvent('fee.paid', { schoolId, studentId: fee.studentId, amountPaid });
  return ApiResponse.success(res, 200, fee, 'Payment recorded successfully');
});

export const getFeeSummary = asyncHandler(async (req, res) => {
  const { role, schoolId } = (req as AuthenticatedRequest).user;
  if (role !== 'admin') throw new ApiError(403, 'Only admin can view fee summary');

  const records = await FeeRecord.find({ schoolId, isArchived: false });
  const totalDue = records.reduce((sum, record) => sum + record.totalAmount, 0);
  const collected = records.reduce((sum, record) => sum + record.paidAmount, 0);
  const pending = records.reduce((sum, record) => sum + record.pendingAmount, 0);
  const year = new Date().getFullYear();
  const monthlyData = Array.from({ length: 12 }, (_, index) => {
    const month = monthName(index + 1);
    const monthTotal = records.reduce((sum, record) => {
      const paid = record.installments
        .filter((item) => item.paidDate?.startsWith(`${year}-${month}`))
        .reduce((inner, item) => inner + item.amount, 0);
      return sum + paid;
    }, 0);
    return { month, collected: monthTotal };
  });

  return ApiResponse.success(res, 200, { totalDue, collected, pending, monthlyData }, 'Fee summary fetched successfully');
});

export const getOverdueFees = asyncHandler(async (req, res) => {
  const { role, schoolId } = (req as AuthenticatedRequest).user;
  if (role !== 'admin') throw new ApiError(403, 'Only admin can view overdue fees');

  const today = new Date().toISOString().slice(0, 10);
  const records = await FeeRecord.find({ schoolId, isArchived: false });
  const overdue = records
    .map((record) => ({
      ...record.toObject(),
      overdueInstallments: record.installments.filter((item) => item.dueDate < today && item.status !== 'paid'),
    }))
    .filter((record) => record.overdueInstallments.length > 0);

  const studentDetails = overdue.length
    ? (await axios.get(`${env.USER_SERVICE_URL}/internal/student-details`, {
        params: { ids: overdue.map((record) => record.studentId).join(',') },
      })).data.data as Array<{ _id: string; name: string }>
    : [];
  const studentMap = new Map(studentDetails.map((student) => [student._id, student.name]));

  return ApiResponse.success(
    res,
    200,
    overdue.map((record) => ({
      ...record,
      studentName: studentMap.get(record.studentId) ?? 'Unknown',
      overdueAmount: record.overdueInstallments.reduce((sum, item) => sum + item.amount, 0),
    })),
    'Overdue fees fetched successfully',
  );
});

export const exportFeeReport = asyncHandler(async (req, res) => {
  const { role, schoolId } = (req as AuthenticatedRequest).user;
  if (role !== 'admin') throw new ApiError(403, 'Only admin can export fee reports');

  const academicYear = String(req.query.academicYear ?? '');
  const format = String(req.query.format ?? 'csv').toLowerCase();
  if (!academicYear) throw new ApiError(400, 'academicYear is required');
  if (format !== 'csv') throw new ApiError(400, 'Only csv export is supported');

  const records = await FeeRecord.find({ schoolId, academicYear, isArchived: false }).sort({ createdAt: -1 });
  const studentDetails = records.length
    ? (await axios.get(`${env.USER_SERVICE_URL}/internal/student-details`, {
        params: { ids: records.map((record) => record.studentId).join(',') },
      })).data.data as Array<{ _id: string; name: string; classId?: string }>
    : [];
  const studentMap = new Map(studentDetails.map((student) => [student._id, student]));

  const rows = [
    ['Student Name', 'Student ID', 'Class ID', 'Academic Year', 'Total Amount', 'Paid Amount', 'Pending Amount', 'Status'],
    ...records.map((record) => {
      const student = studentMap.get(record.studentId);
      const status = record.pendingAmount <= 0 ? 'paid' : record.installments.some((item) => item.status === 'overdue') ? 'overdue' : 'pending';
      return [
        student?.name ?? 'Unknown',
        record.studentId,
        student?.classId ?? '',
        record.academicYear,
        record.totalAmount,
        record.paidAmount,
        record.pendingAmount,
        status,
      ];
    }),
  ];

  const csv = rows.map((row) => row.map((value) => csvEscape(value)).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="fees-report.csv"');
  res.status(200).send(csv);
});

export const getInternalSummary = asyncHandler(async (req, res) => {
  const schoolId = String(req.header('x-school-id') ?? '');
  const records = await FeeRecord.find({ schoolId, isArchived: false });
  const collected = records.reduce((sum, record) => sum + record.paidAmount, 0);
  const pending = records.reduce((sum, record) => sum + record.pendingAmount, 0);
  const total = records.reduce((sum, record) => sum + record.totalAmount, 0);
  return ApiResponse.success(res, 200, { collected, pending, total }, 'Internal fee summary fetched successfully');
});
