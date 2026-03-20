import axios from 'axios';
import { Router } from 'express';
import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { env } from '../config/env';

const router = Router();

const buildHeaders = (headers: Record<string, string | string[] | undefined>) => ({
  'x-user-id': typeof headers['x-user-id'] === 'string' ? headers['x-user-id'] : '',
  'x-user-role': typeof headers['x-user-role'] === 'string' ? headers['x-user-role'] : '',
  'x-school-id': typeof headers['x-school-id'] === 'string' ? headers['x-school-id'] : '',
  'x-user-name': typeof headers['x-user-name'] === 'string' ? headers['x-user-name'] : '',
});

const ensureRole = (expectedRole: string, currentRole?: string): void => {
  if (currentRole !== expectedRole) {
    throw new ApiError(403, 'Forbidden');
  }
};

const settledValue = <T>(result: PromiseSettledResult<{ data: { data: T } }>, fallback: T): T =>
  result.status === 'fulfilled' ? result.value.data.data : fallback;

router.get(
  '/api/dashboard/admin',
  asyncHandler(async (req, res) => {
    ensureRole('admin', req.header('x-user-role') ?? undefined);

    const headers = buildHeaders(req.headers);
    const [userStats, attendanceStats, feeSummary] = await Promise.allSettled([
      axios.get(`${env.USER_SERVICE_URL}/internal/stats`, { headers }),
      axios.get(`${env.ATTENDANCE_SERVICE_URL}/internal/admin-summary`, { headers }),
      axios.get(`${env.FEE_SERVICE_URL}/internal/summary`, { headers }),
    ]);

    const users = settledValue(userStats, { studentCount: 0, teacherCount: 0 });
    const attendance = settledValue(attendanceStats, {
      attendanceToday: { percentage: 0, present: 0, absent: 0 },
      weeklyAttendance: [],
      recentActivity: [],
    });
    const fees = settledValue(feeSummary, { collected: 0, pending: 0, total: 0 });

    return ApiResponse.success(
      res,
      200,
      {
        totalStudents: users.studentCount,
        totalTeachers: users.teacherCount,
        attendanceToday: attendance.attendanceToday,
        feeSummary: fees,
        weeklyAttendance: attendance.weeklyAttendance,
        recentActivity: attendance.recentActivity,
      },
      'Admin dashboard fetched successfully',
    );
  }),
);

router.get(
  '/api/dashboard/teacher',
  asyncHandler(async (req, res) => {
    const userId = req.header('x-user-id') ?? '';
    ensureRole('teacher', req.header('x-user-role') ?? undefined);

    const headers = buildHeaders(req.headers);
    const [classes, todayStatus] = await Promise.all([
      axios.get(`${env.ACADEMIC_SERVICE_URL}/internal/teacher-classes/${userId}`, { headers }),
      axios.get(`${env.ATTENDANCE_SERVICE_URL}/internal/teacher-today/${userId}`, { headers }),
    ]);

    return ApiResponse.success(
      res,
      200,
      {
        assignedClasses: classes.data.data,
        attendanceStatus: todayStatus.data.data,
      },
      'Teacher dashboard fetched successfully',
    );
  }),
);

router.get(
  '/api/dashboard/parent',
  asyncHandler(async (req, res) => {
    const userId = req.header('x-user-id') ?? '';
    ensureRole('parent', req.header('x-user-role') ?? undefined);

    const headers = buildHeaders(req.headers);
    const childrenResponse = await axios.get(`${env.USER_SERVICE_URL}/internal/parent-children/${userId}`, {
      headers,
    });
    const children = childrenResponse.data.data as Array<{ _id: string; name: string }>;

    const childSummaries = await Promise.all(
      children.map(async (child) => {
        const [attendance, fee] = await Promise.all([
          axios.get(`${env.ATTENDANCE_SERVICE_URL}/internal/summary/${child._id}`, { headers }),
          axios.get(`${env.FEE_SERVICE_URL}/fees/student/${child._id}`, { headers }),
        ]);

        return {
          ...child,
          attendancePercentage: attendance.data.data.allTime.percentage,
          feePending: fee.data.data.pendingAmount,
        };
      }),
    );

    return ApiResponse.success(
      res,
      200,
      { children: childSummaries },
      'Parent dashboard fetched successfully',
    );
  }),
);

export default router;
