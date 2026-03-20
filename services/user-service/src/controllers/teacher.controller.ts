import axios from 'axios';
import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { TeacherProfile } from '../models/TeacherProfile';

export const getTeachers = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const query: Record<string, unknown> = { schoolId, isActive: true };
  if (req.query.search) {
    const search = String(req.query.search);
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  const [teachers, total] = await Promise.all([
    TeacherProfile.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    TeacherProfile.countDocuments(query),
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
  const teacher = await TeacherProfile.findOne({ _id: req.params.id, schoolId });
  if (!teacher) throw new ApiError(404, 'Teacher not found');

  const classes = teacher.assignedClassIds.length
    ? (await axios.get(`${env.ACADEMIC_SERVICE_URL}/internal/classes-by-ids`, {
        params: { ids: teacher.assignedClassIds.join(',') },
        headers: { 'x-school-id': schoolId },
      })).data.data
    : [];

  return ApiResponse.success(res, 200, { ...teacher.toObject(), classes }, 'Teacher fetched successfully');
});

export const createTeacher = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const { name, email, phone, subjects, experienceYears, qualification } = req.body as {
    name: string;
    email: string;
    phone: string;
    subjects: string[];
    experienceYears: number;
    qualification?: string;
  };

  const tempPassword = `Teach@${phone.slice(-4) || '1234'}`;
  const authResponse = await axios.post(`${env.AUTH_SERVICE_URL}/internal/create-user`, {
    email,
    phone,
    role: 'teacher',
    schoolId,
    tempPassword,
  });

  const teacher = await TeacherProfile.create({
    schoolId,
    userId: authResponse.data.data.userId,
    name,
    email,
    phone,
    subjects,
    experienceYears,
    qualification,
    assignedClassIds: [],
  });

  return ApiResponse.success(res, 201, { teacher, tempPassword }, 'Teacher created successfully');
});

export const updateTeacher = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const teacher = await TeacherProfile.findOneAndUpdate({ _id: req.params.id, schoolId }, req.body, { new: true });
  if (!teacher) throw new ApiError(404, 'Teacher not found');
  return ApiResponse.success(res, 200, teacher, 'Teacher updated successfully');
});

export const deleteTeacher = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const teacher = await TeacherProfile.findOneAndUpdate(
    { _id: req.params.id, schoolId },
    { $set: { isActive: false } },
    { new: true },
  );
  if (!teacher) throw new ApiError(404, 'Teacher not found');
  return ApiResponse.success(res, 200, teacher, 'Teacher deleted successfully');
});

export const assignClasses = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const teacher = await TeacherProfile.findOneAndUpdate(
    { _id: req.params.id, schoolId },
    { $set: { assignedClassIds: req.body.classIds } },
    { new: true },
  );
  if (!teacher) throw new ApiError(404, 'Teacher not found');
  return ApiResponse.success(res, 200, teacher, 'Classes assigned successfully');
});
