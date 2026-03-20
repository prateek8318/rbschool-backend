"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInternalSummary = exports.getOverdueFees = exports.getFeeSummary = exports.recordPayment = exports.createFeeRecord = exports.getStudentFee = exports.getAllFees = void 0;
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@rbschool/shared");
const env_1 = require("../config/env");
const publisher_1 = require("../events/publisher");
const FeeRecord_1 = require("../models/FeeRecord");
const monthName = (value) => String(value).padStart(2, '0');
exports.getAllFees = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId, role, schoolId } = req.user;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    let studentIds = null;
    if (req.query.classId) {
        const studentResponse = await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/students`, {
            params: { classId: req.query.classId, page: 1, limit: 1000 },
            headers: { 'x-user-id': userId, 'x-user-role': role, 'x-school-id': schoolId },
        });
        studentIds = studentResponse.data.data.map((student) => student._id);
    }
    const query = { schoolId, isArchived: false };
    if (studentIds)
        query.studentId = { $in: studentIds };
    let records = await FeeRecord_1.FeeRecord.find(query).sort({ createdAt: -1 });
    if (req.query.status) {
        const status = String(req.query.status);
        records = records.filter((record) => record.installments.some((item) => item.status === status));
    }
    const studentDetails = records.length
        ? (await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/student-details`, {
            params: { ids: records.map((record) => record.studentId).join(',') },
        })).data.data
        : [];
    const studentMap = new Map(studentDetails.map((student) => [student._id, student]));
    let merged = records.map((record) => ({ ...record.toObject(), student: studentMap.get(record.studentId) ?? null }));
    if (req.query.search) {
        const search = String(req.query.search).toLowerCase();
        merged = merged.filter((record) => (record.student?.name ?? '').toLowerCase().includes(search));
    }
    const start = (page - 1) * limit;
    const paged = merged.slice(start, start + limit);
    return shared_1.ApiResponse.success(res, 200, paged, 'Fee records fetched successfully', {
        page,
        limit,
        total: merged.length,
        totalPages: Math.ceil(merged.length / limit) || 1,
    });
});
exports.getStudentFee = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const fee = await FeeRecord_1.FeeRecord.findOne({ schoolId, studentId: req.params.studentId, isArchived: false }).sort({ createdAt: -1 });
    if (!fee)
        throw new shared_1.ApiError(404, 'Fee record not found');
    fee.pendingAmount = Math.max(0, fee.totalAmount - fee.paidAmount);
    await fee.save();
    return shared_1.ApiResponse.success(res, 200, fee, 'Student fee fetched successfully');
});
exports.createFeeRecord = (0, shared_1.asyncHandler)(async (req, res) => {
    const { role, schoolId } = req.user;
    if (role !== 'admin')
        throw new shared_1.ApiError(403, 'Only admin can create fee records');
    const { studentId, academicYear, totalAmount, installments } = req.body;
    const exists = await FeeRecord_1.FeeRecord.findOne({ schoolId, studentId, academicYear });
    if (exists)
        throw new shared_1.ApiError(409, 'Fee record already exists');
    const fee = await FeeRecord_1.FeeRecord.create({
        schoolId,
        studentId,
        academicYear,
        totalAmount,
        paidAmount: 0,
        pendingAmount: totalAmount,
        installments: installments.map((item) => ({ ...item, status: 'pending' })),
    });
    return shared_1.ApiResponse.success(res, 201, fee, 'Fee record created successfully');
});
exports.recordPayment = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId, schoolId } = req.user;
    const { quarter, amountPaid, paymentMode, transactionId } = req.body;
    const fee = await FeeRecord_1.FeeRecord.findOne({ _id: req.params.id, schoolId, isArchived: false });
    if (!fee)
        throw new shared_1.ApiError(404, 'Fee record not found');
    const installment = fee.installments.find((item) => item.quarter === quarter);
    if (!installment)
        throw new shared_1.ApiError(404, 'Installment not found');
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
    await (0, publisher_1.publishEvent)('fee.paid', { schoolId, studentId: fee.studentId, amountPaid });
    return shared_1.ApiResponse.success(res, 200, fee, 'Payment recorded successfully');
});
exports.getFeeSummary = (0, shared_1.asyncHandler)(async (req, res) => {
    const { role, schoolId } = req.user;
    if (role !== 'admin')
        throw new shared_1.ApiError(403, 'Only admin can view fee summary');
    const records = await FeeRecord_1.FeeRecord.find({ schoolId, isArchived: false });
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
    return shared_1.ApiResponse.success(res, 200, { totalDue, collected, pending, monthlyData }, 'Fee summary fetched successfully');
});
exports.getOverdueFees = (0, shared_1.asyncHandler)(async (req, res) => {
    const { role, schoolId } = req.user;
    if (role !== 'admin')
        throw new shared_1.ApiError(403, 'Only admin can view overdue fees');
    const today = new Date().toISOString().slice(0, 10);
    const records = await FeeRecord_1.FeeRecord.find({ schoolId, isArchived: false });
    const overdue = records
        .map((record) => ({
        ...record.toObject(),
        overdueInstallments: record.installments.filter((item) => item.dueDate < today && item.status !== 'paid'),
    }))
        .filter((record) => record.overdueInstallments.length > 0);
    const studentDetails = overdue.length
        ? (await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/student-details`, {
            params: { ids: overdue.map((record) => record.studentId).join(',') },
        })).data.data
        : [];
    const studentMap = new Map(studentDetails.map((student) => [student._id, student.name]));
    return shared_1.ApiResponse.success(res, 200, overdue.map((record) => ({
        ...record,
        studentName: studentMap.get(record.studentId) ?? 'Unknown',
        overdueAmount: record.overdueInstallments.reduce((sum, item) => sum + item.amount, 0),
    })), 'Overdue fees fetched successfully');
});
exports.getInternalSummary = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.header('x-school-id') ?? '');
    const records = await FeeRecord_1.FeeRecord.find({ schoolId, isArchived: false });
    const collected = records.reduce((sum, record) => sum + record.paidAmount, 0);
    const pending = records.reduce((sum, record) => sum + record.pendingAmount, 0);
    const total = records.reduce((sum, record) => sum + record.totalAmount, 0);
    return shared_1.ApiResponse.success(res, 200, { collected, pending, total }, 'Internal fee summary fetched successfully');
});
