import axios from 'axios';
import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/db';

export const getTeachers = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  
  const where: any = { schoolId, isActive: true };
  if (req.query.search) {
    const search = String(req.query.search);
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [teachers, total] = await Promise.all([
    prisma.teacherProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.teacherProfile.count({ where }),
  ]);

  return ApiResponse.success(
    res,
    200,
    teachers,
    'Teachers fetched successfully',
    { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  );
});

export const getTeacherById = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const teacher = await prisma.teacherProfile.findFirst({
    where: { id: req.params.id, schoolId },
  });
  if (!teacher) throw new ApiError(404, 'Teacher not found');

  const classes = teacher.assignedClassIds.length
    ? (await axios.get(`${env.ACADEMIC_SERVICE_URL}/internal/classes-by-ids`, {
        params: { ids: teacher.assignedClassIds.join(',') },
        headers: { 'x-school-id': schoolId },
      })).data.data
    : [];

  return ApiResponse.success(res, 200, { ...teacher, classes }, 'Teacher fetched successfully');
});

export const getTeacherDashboard = asyncHandler(async (req, res) => {
  const { userId, schoolId } = (req as AuthenticatedRequest).user;
  
  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId },
  });
  
  if (!teacher) throw new ApiError(404, 'Teacher profile not found');

  // Fetch classes and attendance stats for each class
  const classesResponse = await axios.get(`${env.ACADEMIC_SERVICE_URL}/internal/classes-by-ids`, {
    params: { ids: teacher.assignedClassIds.join(',') },
    headers: { 'x-school-id': schoolId },
  });
  
  const classes = classesResponse.data.data;

  // Mock schedule (since we don't have a schedule model yet, but to match UI)
  const todaySchedule = [
    { id: '1', time: '8:00 - 8:45 AM', subject: 'Mathematics', class: '9-A', status: 'Now' },
    { id: '2', time: '9:00 - 9:45 AM', subject: 'Mathematics', class: '10-B', status: 'Upcoming' },
    { id: '3', time: '11:00 - 11:45 AM', subject: 'Mathematics', class: '8-A', status: 'Upcoming' },
  ];

  return ApiResponse.success(res, 200, {
    teacherName: teacher.name,
    todaySchedule,
    classes: classes.map((c: any) => ({
      ...c,
      attendancePercentage: Math.floor(Math.random() * (98 - 75 + 1) + 75), // Mocking stats for now
    })),
  });
});

export const createTeacher = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const { name, email, phone, subjects, experienceYears, qualification } = req.body;

  const tempPassword = `Teach@${phone.slice(-4) || '1234'}`;
  const authResponse = await axios.post(`${env.AUTH_SERVICE_URL}/internal/create-user`, {
    email,
    phone,
    role: 'teacher',
    schoolId,
    tempPassword,
  });

  const teacher = await prisma.teacherProfile.create({
    data: {
      schoolId,
      userId: authResponse.data.data.userId,
      name,
      email,
      phone,
      subjects: subjects || [],
      experienceYears: Number(experienceYears),
      qualification,
      assignedClassIds: [],
    },
  });

  return ApiResponse.success(res, 201, { teacher, tempPassword }, 'Teacher created successfully');
});

export const updateTeacher = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const teacher = await prisma.teacherProfile.updateMany({
    where: { id: req.params.id, schoolId },
    data: req.body,
  });
  if (teacher.count === 0) throw new ApiError(404, 'Teacher not found');
  
  const updatedTeacher = await prisma.teacherProfile.findUnique({ where: { id: req.params.id } });
  return ApiResponse.success(res, 200, updatedTeacher, 'Teacher updated successfully');
});

export const deleteTeacher = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  await prisma.teacherProfile.updateMany({
    where: { id: req.params.id, schoolId },
    data: { isActive: false },
  });
  return ApiResponse.success(res, 200, null, 'Teacher deleted successfully');
});

export const assignClasses = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const teacher = await prisma.teacherProfile.updateMany({
    where: { id: req.params.id, schoolId },
    data: { assignedClassIds: req.body.classIds },
  });
  if (teacher.count === 0) throw new ApiError(404, 'Teacher not found');
  
  const updatedTeacher = await prisma.teacherProfile.findUnique({ where: { id: req.params.id } });
  return ApiResponse.success(res, 200, updatedTeacher, 'Classes assigned successfully');
});
