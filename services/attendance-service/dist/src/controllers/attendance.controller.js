"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeacherToday = exports.getInternalToday = exports.addHoliday = exports.getHolidays = exports.getTodayOverview = exports.getStudentSummary = exports.getAttendanceReport = exports.getStudentMonthly = exports.getAttendanceByClass = exports.bulkMarkAttendance = void 0;
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@rbschool/shared");
const env_1 = require("../config/env");
const publisher_1 = require("../events/publisher");
const Attendance_1 = require("../models/Attendance");
const HolidayCalendar_1 = require("../models/HolidayCalendar");
const getToday = () => new Date().toISOString().slice(0, 10);
const percentage = (present, total) => (total === 0 ? 0 : Number(((present / total) * 100).toFixed(2)));
exports.bulkMarkAttendance = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId, role, schoolId } = req.user;
    const { classId, date, records } = req.body;
    if (date > getToday())
        throw new shared_1.ApiError(400, 'Future dates are not allowed');
    const classResponse = await axios_1.default.get(`${env_1.env.ACADEMIC_SERVICE_URL}/internal/class/${classId}`, {
        headers: { 'x-school-id': schoolId },
    });
    if (role === 'teacher' && classResponse.data.data.teacherId !== userId) {
        throw new shared_1.ApiError(403, 'You are not assigned to this class');
    }
    const existingCount = await Attendance_1.Attendance.countDocuments({ schoolId, classId, date });
    if (existingCount > 0 && role === 'teacher') {
        throw new shared_1.ApiError(400, 'Already submitted, contact admin');
    }
    if (existingCount > 0 && role === 'admin') {
        await Attendance_1.Attendance.deleteMany({ schoolId, classId, date });
    }
    await Attendance_1.Attendance.insertMany(records.map((record) => ({
        schoolId,
        classId,
        studentId: record.studentId,
        date,
        status: record.status,
        markedBy: userId,
    })));
    const absentStudentIds = records.filter((record) => record.status === 'absent').map((record) => record.studentId);
    await (0, publisher_1.publishEvent)('attendance.marked', { classId, date, schoolId, absentStudentIds });
    return shared_1.ApiResponse.success(res, 200, { marked: records.length, updated: existingCount > 0 ? records.length : 0 }, 'Attendance marked successfully');
});
exports.getAttendanceByClass = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const records = await Attendance_1.Attendance.find({ schoolId, classId: String(req.query.classId), date: String(req.query.date) });
    return shared_1.ApiResponse.success(res, 200, records, 'Attendance fetched successfully');
});
exports.getStudentMonthly = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-31`;
    const records = await Attendance_1.Attendance.find({ schoolId, studentId: req.params.id, date: { $gte: start, $lte: end } }).sort({ date: 1 });
    const present = records.filter((record) => record.status === 'present').length;
    const absent = records.filter((record) => record.status === 'absent').length;
    return shared_1.ApiResponse.success(res, 200, {
        calendar: records.map((record) => ({ date: record.date, status: record.status })),
        total: records.length,
        present,
        absent,
        percentage: percentage(present, records.length),
    }, 'Student monthly attendance fetched successfully');
});
exports.getAttendanceReport = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const classId = String(req.query.classId);
    const from = String(req.query.from);
    const to = String(req.query.to);
    const records = await Attendance_1.Attendance.find({ schoolId, classId, date: { $gte: from, $lte: to } });
    const summary = new Map();
    records.forEach((record) => {
        const item = summary.get(record.studentId) ?? { total: 0, present: 0, absent: 0 };
        item.total += 1;
        if (record.status === 'present')
            item.present += 1;
        if (record.status === 'absent')
            item.absent += 1;
        summary.set(record.studentId, item);
    });
    const studentIds = Array.from(summary.keys());
    const studentResponse = studentIds.length
        ? await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/student-details`, { params: { ids: studentIds.join(',') } })
        : { data: { data: [] } };
    const studentMap = new Map(studentResponse.data.data.map((student) => [student._id, student.name]));
    const report = Array.from(summary.entries()).map(([studentId, item]) => ({
        studentId,
        name: studentMap.get(studentId) ?? 'Unknown',
        total: item.total,
        present: item.present,
        absent: item.absent,
        percentage: percentage(item.present, item.total),
    })).sort((a, b) => a.percentage - b.percentage);
    return shared_1.ApiResponse.success(res, 200, report, 'Attendance report fetched successfully');
});
exports.getStudentSummary = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.header('x-school-id') ?? req.user.schoolId);
    const studentId = req.params.studentId ?? req.params.id;
    const allRecords = await Attendance_1.Attendance.find({ schoolId, studentId });
    const last30Cutoff = new Date();
    last30Cutoff.setDate(last30Cutoff.getDate() - 30);
    const last30 = allRecords.filter((record) => new Date(record.date) >= last30Cutoff);
    const currentYear = new Date().getFullYear();
    const monthlyBreakdown = Array.from({ length: 12 }, (_, index) => {
        const month = String(index + 1).padStart(2, '0');
        const monthRecords = allRecords.filter((record) => record.date.startsWith(`${currentYear}-${month}`));
        const present = monthRecords.filter((record) => record.status === 'present').length;
        return { month, total: monthRecords.length, present, percentage: percentage(present, monthRecords.length) };
    });
    return shared_1.ApiResponse.success(res, 200, {
        allTime: {
            total_days: allRecords.length,
            present: allRecords.filter((record) => record.status === 'present').length,
            absent: allRecords.filter((record) => record.status === 'absent').length,
            percentage: percentage(allRecords.filter((record) => record.status === 'present').length, allRecords.length),
        },
        last30Days: {
            total_days: last30.length,
            present: last30.filter((record) => record.status === 'present').length,
            absent: last30.filter((record) => record.status === 'absent').length,
            percentage: percentage(last30.filter((record) => record.status === 'present').length, last30.length),
        },
        monthlyBreakdown,
    }, 'Student summary fetched successfully');
});
exports.getTodayOverview = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const today = getToday();
    const records = await Attendance_1.Attendance.find({ schoolId, date: today });
    const grouped = new Map();
    records.forEach((record) => {
        const item = grouped.get(record.classId) ?? { total: 0, present: 0, absent: 0 };
        item.total += 1;
        if (record.status === 'present')
            item.present += 1;
        if (record.status === 'absent')
            item.absent += 1;
        grouped.set(record.classId, item);
    });
    const classIds = Array.from(grouped.keys());
    const classResponse = classIds.length
        ? await axios_1.default.get(`${env_1.env.ACADEMIC_SERVICE_URL}/internal/classes-by-ids`, {
            params: { ids: classIds.join(',') },
            headers: { 'x-school-id': schoolId },
        })
        : { data: { data: [] } };
    const classMap = new Map(classResponse.data.data.map((item) => [item._id, `${item.name}-${item.section}`]));
    const overview = Array.from(grouped.entries()).map(([classId, item]) => ({
        classId,
        className: classMap.get(classId) ?? classId,
        total: item.total,
        present: item.present,
        absent: item.absent,
        percentage: percentage(item.present, item.total),
    }));
    return shared_1.ApiResponse.success(res, 200, overview, 'Today overview fetched successfully');
});
exports.getHolidays = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const month = String(req.query.month).padStart(2, '0');
    const year = String(req.query.year);
    const records = await HolidayCalendar_1.HolidayCalendar.find({ schoolId, date: { $regex: `^${year}-${month}` } }).sort({ date: 1 });
    return shared_1.ApiResponse.success(res, 200, records, 'Holidays fetched successfully');
});
exports.addHoliday = (0, shared_1.asyncHandler)(async (req, res) => {
    const { role, schoolId } = req.user;
    if (role !== 'admin')
        throw new shared_1.ApiError(403, 'Only admin can add holidays');
    const holiday = await HolidayCalendar_1.HolidayCalendar.create({ ...req.body, schoolId });
    return shared_1.ApiResponse.success(res, 201, holiday, 'Holiday added successfully');
});
exports.getInternalToday = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.header('x-school-id') ?? '');
    const records = await Attendance_1.Attendance.find({ schoolId, date: getToday() });
    const totalPresent = records.filter((record) => record.status === 'present').length;
    const totalAbsent = records.filter((record) => record.status === 'absent').length;
    return shared_1.ApiResponse.success(res, 200, {
        overallPercentage: percentage(totalPresent, records.length),
        totalPresent,
        totalAbsent,
    }, 'Internal today overview fetched successfully');
});
exports.getTeacherToday = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.header('x-school-id') ?? '');
    const classResponse = await axios_1.default.get(`${env_1.env.ACADEMIC_SERVICE_URL}/internal/teacher-classes/${req.params.teacherId}`, {
        headers: { 'x-school-id': schoolId },
    });
    const classIds = classResponse.data.data.map((item) => item._id);
    const records = await Attendance_1.Attendance.find({ schoolId, classId: { $in: classIds }, date: getToday() });
    return shared_1.ApiResponse.success(res, 200, { totalMarkedRecords: records.length, classesCount: classIds.length }, 'Teacher today status fetched successfully');
});
