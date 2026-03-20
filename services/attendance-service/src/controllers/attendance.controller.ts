import axios from 'axios';
import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { env } from '../config/env';
import { publishEvent } from '../events/publisher';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Attendance } from '../models/Attendance';
import { HolidayCalendar } from '../models/HolidayCalendar';

const getToday = (): string => new Date().toISOString().slice(0, 10);

const percentage = (present: number, total: number): number => (total === 0 ? 0 : Number(((present / total) * 100).toFixed(2)));

const csvEscape = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

export const bulkMarkAttendance = asyncHandler(async (req, res) => {
  const { userId, role, schoolId } = (req as AuthenticatedRequest).user;
  const { classId, date, records } = req.body as { classId: string; date: string; records: Array<{ studentId: string; status: string }> };
  if (date > getToday()) throw new ApiError(400, 'Future dates are not allowed');

  const classResponse = await axios.get(`${env.ACADEMIC_SERVICE_URL}/internal/class/${classId}`, {
    headers: { 'x-school-id': schoolId },
  });
  if (role === 'teacher' && classResponse.data.data.teacherId !== userId) {
    throw new ApiError(403, 'You are not assigned to this class');
  }

  const existingCount = await Attendance.countDocuments({ schoolId, classId, date });
  if (existingCount > 0 && role === 'teacher') {
    throw new ApiError(400, 'Already submitted, contact admin');
  }
  if (existingCount > 0 && role === 'admin') {
    await Attendance.deleteMany({ schoolId, classId, date });
  }

  await Attendance.insertMany(
    records.map((record) => ({
      schoolId,
      classId,
      studentId: record.studentId,
      date,
      status: record.status,
      markedBy: userId,
    })),
  );

  const absentStudentIds = records.filter((record) => record.status === 'absent').map((record) => record.studentId);
  await publishEvent('attendance.marked', { classId, date, schoolId, absentStudentIds });

  return ApiResponse.success(res, 200, { marked: records.length, updated: existingCount > 0 ? records.length : 0 }, 'Attendance marked successfully');
});

export const getAttendanceByClass = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const records = await Attendance.find({ schoolId, classId: String(req.query.classId), date: String(req.query.date) });
  return ApiResponse.success(res, 200, records, 'Attendance fetched successfully');
});

export const getStudentMonthly = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-31`;
  const records = await Attendance.find({ schoolId, studentId: req.params.id, date: { $gte: start, $lte: end } }).sort({ date: 1 });
  const present = records.filter((record) => record.status === 'present').length;
  const absent = records.filter((record) => record.status === 'absent').length;
  return ApiResponse.success(res, 200, {
    calendar: records.map((record) => ({ date: record.date, status: record.status })),
    total: records.length,
    present,
    absent,
    percentage: percentage(present, records.length),
  }, 'Student monthly attendance fetched successfully');
});

export const getAttendanceReport = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const classId = String(req.query.classId);
  const from = String(req.query.from);
  const to = String(req.query.to);
  const records = await Attendance.find({ schoolId, classId, date: { $gte: from, $lte: to } });
  const summary = new Map<string, { total: number; present: number; absent: number }>();
  records.forEach((record) => {
    const item = summary.get(record.studentId) ?? { total: 0, present: 0, absent: 0 };
    item.total += 1;
    if (record.status === 'present') item.present += 1;
    if (record.status === 'absent') item.absent += 1;
    summary.set(record.studentId, item);
  });
  const studentIds = Array.from(summary.keys());
  const studentResponse = studentIds.length
    ? await axios.get(`${env.USER_SERVICE_URL}/internal/student-details`, { params: { ids: studentIds.join(',') } })
    : { data: { data: [] } };
  const studentMap = new Map((studentResponse.data.data as Array<{ _id: string; name: string }>).map((student) => [student._id, student.name]));
  const report = Array.from(summary.entries()).map(([studentId, item]) => ({
    studentId,
    name: studentMap.get(studentId) ?? 'Unknown',
    total: item.total,
    present: item.present,
    absent: item.absent,
    percentage: percentage(item.present, item.total),
  })).sort((a, b) => a.percentage - b.percentage);

  return ApiResponse.success(res, 200, report, 'Attendance report fetched successfully');
});

export const exportAttendanceReport = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const classId = String(req.query.classId);
  const from = String(req.query.from);
  const to = String(req.query.to);
  const format = String(req.query.format ?? 'csv').toLowerCase();
  if (format !== 'csv') throw new ApiError(400, 'Only csv export is supported');

  const records = await Attendance.find({ schoolId, classId, date: { $gte: from, $lte: to } });
  const grouped = new Map<string, { present: number; absent: number; total: number }>();
  records.forEach((record) => {
    const current = grouped.get(record.studentId) ?? { present: 0, absent: 0, total: 0 };
    current.total += 1;
    if (record.status === 'present') current.present += 1;
    if (record.status === 'absent') current.absent += 1;
    grouped.set(record.studentId, current);
  });

  const studentIds = Array.from(grouped.keys());
  const studentResponse = studentIds.length
    ? await axios.get(`${env.USER_SERVICE_URL}/internal/student-details`, { params: { ids: studentIds.join(',') } })
    : { data: { data: [] } };
  const studentMap = new Map((studentResponse.data.data as Array<{ _id: string; name: string }>).map((student) => [student._id, student.name]));

  const rows = [
    ['Student Name', 'Student ID', 'Present Days', 'Absent Days', 'Total Days', 'Attendance Percentage'],
    ...Array.from(grouped.entries()).map(([studentId, item]) => [
      studentMap.get(studentId) ?? 'Unknown',
      studentId,
      item.present,
      item.absent,
      item.total,
      percentage(item.present, item.total),
    ]),
  ];

  const csv = rows.map((row) => row.map((value) => csvEscape(value)).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
  res.status(200).send(csv);
});

export const getStudentSummary = asyncHandler(async (req, res) => {
  const schoolId = String(req.header('x-school-id') ?? (req as AuthenticatedRequest).user.schoolId);
  const studentId = req.params.studentId ?? req.params.id;
  const allRecords = await Attendance.find({ schoolId, studentId });
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

  return ApiResponse.success(res, 200, {
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

export const getTodayOverview = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const today = getToday();
  const records = await Attendance.find({ schoolId, date: today });
  const grouped = new Map<string, { total: number; present: number; absent: number }>();
  records.forEach((record) => {
    const item = grouped.get(record.classId) ?? { total: 0, present: 0, absent: 0 };
    item.total += 1;
    if (record.status === 'present') item.present += 1;
    if (record.status === 'absent') item.absent += 1;
    grouped.set(record.classId, item);
  });

  const classIds = Array.from(grouped.keys());
  const classResponse = classIds.length
    ? await axios.get(`${env.ACADEMIC_SERVICE_URL}/internal/classes-by-ids`, {
        params: { ids: classIds.join(',') },
        headers: { 'x-school-id': schoolId },
      })
    : { data: { data: [] } };
  const classMap = new Map((classResponse.data.data as Array<{ _id: string; name: string; section: string }>).map((item) => [item._id, `${item.name}-${item.section}`]));

  const overview = Array.from(grouped.entries()).map(([classId, item]) => ({
    classId,
    className: classMap.get(classId) ?? classId,
    total: item.total,
    present: item.present,
    absent: item.absent,
    percentage: percentage(item.present, item.total),
  }));

  return ApiResponse.success(res, 200, overview, 'Today overview fetched successfully');
});

export const getLowAttendance = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const threshold = Number(req.query.threshold ?? 75);
  const records = await Attendance.find({ schoolId });
  const summary = new Map<string, { present: number; total: number }>();

  records.forEach((record) => {
    const current = summary.get(record.studentId) ?? { present: 0, total: 0 };
    current.total += 1;
    if (record.status === 'present') current.present += 1;
    summary.set(record.studentId, current);
  });

  const studentIds = Array.from(summary.keys());
  const studentResponse = studentIds.length
    ? await axios.get(`${env.USER_SERVICE_URL}/internal/student-details`, { params: { ids: studentIds.join(',') } })
    : { data: { data: [] } };
  const students = studentResponse.data.data as Array<{ _id: string; name: string; classId?: string; section?: string; rollNumber?: string }>;

  const lowAttendance = students
    .map((student) => {
      const stats = summary.get(student._id) ?? { present: 0, total: 0 };
      return {
        studentId: student._id,
        studentName: student.name,
        classId: student.classId ?? null,
        section: student.section ?? null,
        rollNumber: student.rollNumber ?? null,
        present: stats.present,
        total: stats.total,
        percentage: percentage(stats.present, stats.total),
      };
    })
    .filter((student) => student.total > 0 && student.percentage < threshold)
    .sort((a, b) => a.percentage - b.percentage);

  return ApiResponse.success(res, 200, lowAttendance, 'Low attendance students fetched successfully');
});

export const getHolidays = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const month = String(req.query.month).padStart(2, '0');
  const year = String(req.query.year);
  const records = await HolidayCalendar.find({ schoolId, date: { $regex: `^${year}-${month}` } }).sort({ date: 1 });
  return ApiResponse.success(res, 200, records, 'Holidays fetched successfully');
});

export const addHoliday = asyncHandler(async (req, res) => {
  const { role, schoolId } = (req as AuthenticatedRequest).user;
  if (role !== 'admin') throw new ApiError(403, 'Only admin can add holidays');
  const holiday = await HolidayCalendar.create({ ...req.body, schoolId });
  return ApiResponse.success(res, 201, holiday, 'Holiday added successfully');
});

export const getInternalToday = asyncHandler(async (req, res) => {
  const schoolId = String(req.header('x-school-id') ?? '');
  const records = await Attendance.find({ schoolId, date: getToday() });
  const totalPresent = records.filter((record) => record.status === 'present').length;
  const totalAbsent = records.filter((record) => record.status === 'absent').length;
  return ApiResponse.success(res, 200, {
    overallPercentage: percentage(totalPresent, records.length),
    totalPresent,
    totalAbsent,
  }, 'Internal today overview fetched successfully');
});

export const getInternalAdminSummary = asyncHandler(async (req, res) => {
  const schoolId = String(req.header('x-school-id') ?? '');
  const today = new Date();
  const todayString = today.toISOString().slice(0, 10);
  const weeklyDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });

  const [todayRecords, weeklyRecords, recentRecords] = await Promise.all([
    Attendance.find({ schoolId, date: todayString }).sort({ createdAt: -1 }),
    Attendance.find({ schoolId, date: { $in: weeklyDates } }),
    Attendance.find({ schoolId }).sort({ createdAt: -1 }).limit(10),
  ]);

  const present = todayRecords.filter((record) => record.status === 'present').length;
  const absent = todayRecords.filter((record) => record.status === 'absent').length;

  const studentIds = [...new Set(recentRecords.map((record) => record.studentId))];
  const classIds = [...new Set(recentRecords.map((record) => record.classId))];
  const [studentResponse, classResponse] = await Promise.all([
    studentIds.length
      ? axios.get(`${env.USER_SERVICE_URL}/internal/student-details`, { params: { ids: studentIds.join(',') } })
      : Promise.resolve({ data: { data: [] } }),
    classIds.length
      ? axios.get(`${env.ACADEMIC_SERVICE_URL}/internal/classes-by-ids`, {
          params: { ids: classIds.join(',') },
          headers: { 'x-school-id': schoolId },
        })
      : Promise.resolve({ data: { data: [] } }),
  ]);

  const studentMap = new Map((studentResponse.data.data as Array<{ _id: string; name: string }>).map((student) => [student._id, student.name]));
  const classMap = new Map(
    (classResponse.data.data as Array<{ _id: string; name: string; section: string }>).map((item) => [
      item._id,
      `${item.name}${item.section ? `-${item.section}` : ''}`,
    ]),
  );

  const weeklyAttendance = weeklyDates.map((date) => {
    const dayRecords = weeklyRecords.filter((record) => record.date === date);
    const dayPresent = dayRecords.filter((record) => record.status === 'present').length;
    return {
      day: new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      percentage: percentage(dayPresent, dayRecords.length),
    };
  });

  const recentActivity = recentRecords.slice(0, 5).map((record) => ({
    studentName: studentMap.get(record.studentId) ?? 'Unknown',
    action: record.status === 'present' ? 'Marked present' : record.status === 'absent' ? 'Marked absent' : `Marked ${record.status}`,
    class: classMap.get(record.classId) ?? record.classId,
    time: record.createdAt.toISOString(),
  }));

  return ApiResponse.success(
    res,
    200,
    {
      attendanceToday: {
        percentage: percentage(present, todayRecords.length),
        present,
        absent,
      },
      weeklyAttendance,
      recentActivity,
    },
    'Internal admin attendance summary fetched successfully',
  );
});

export const getTeacherToday = asyncHandler(async (req, res) => {
  const schoolId = String(req.header('x-school-id') ?? '');
  const classResponse = await axios.get(`${env.ACADEMIC_SERVICE_URL}/internal/teacher-classes/${req.params.teacherId}`, {
    headers: { 'x-school-id': schoolId },
  });
  const classIds = (classResponse.data.data as Array<{ _id: string }>).map((item) => item._id);
  const records = await Attendance.find({ schoolId, classId: { $in: classIds }, date: getToday() });
  return ApiResponse.success(res, 200, { totalMarkedRecords: records.length, classesCount: classIds.length }, 'Teacher today status fetched successfully');
});
