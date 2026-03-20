import axios from 'axios';
import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { env } from '../config/env';
import { publishEvent } from '../events/publisher';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ClassModel } from '../models/Class';

export const getClasses = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const query: Record<string, unknown> = { schoolId };
  if (req.query.academicYear) query.academicYear = String(req.query.academicYear);
  const classes = await ClassModel.find(query).sort({ createdAt: -1 });
  const teacherIds = [...new Set(classes.map((item) => item.teacherId).filter(Boolean))] as string[];
  const teacherNames = teacherIds.length
    ? (await axios.get(`${env.USER_SERVICE_URL}/internal/teacher-names`, {
        params: { ids: teacherIds.join(',') },
      })).data.data as Array<{ userId: string; name: string }>
    : [];
  const teacherMap = new Map(teacherNames.map((teacher) => [teacher.userId, teacher.name]));

  return ApiResponse.success(
    res,
    200,
    classes.map((item) => ({ ...item.toObject(), teacherName: item.teacherId ? teacherMap.get(item.teacherId) ?? null : null })),
    'Classes fetched successfully',
  );
});

export const createClass = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const exists = await ClassModel.findOne({
    schoolId,
    name: req.body.name,
    section: req.body.section,
    academicYear: req.body.academicYear,
  });
  if (exists) throw new ApiError(409, 'Class already exists');

  const classDoc = await ClassModel.create({ ...req.body, schoolId });
  await publishEvent('class.created', { schoolId, classId: classDoc.id });
  return ApiResponse.success(res, 201, classDoc, 'Class created successfully');
});

export const updateClass = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const classDoc = await ClassModel.findOneAndUpdate({ _id: req.params.id, schoolId }, req.body, { new: true });
  if (!classDoc) throw new ApiError(404, 'Class not found');
  return ApiResponse.success(res, 200, classDoc, 'Class updated successfully');
});

export const deleteClass = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const classDoc = await ClassModel.findOneAndDelete({ _id: req.params.id, schoolId });
  if (!classDoc) throw new ApiError(404, 'Class not found');
  await publishEvent('class.deleted', { schoolId, classId: classDoc.id });
  return ApiResponse.success(res, 200, classDoc, 'Class deleted successfully');
});

export const getClassStudents = asyncHandler(async (req, res) => {
  const { userId, role, schoolId } = (req as AuthenticatedRequest).user;
  const response = await axios.get(`${env.USER_SERVICE_URL}/students`, {
    params: { classId: req.params.id, page: 1, limit: 500 },
    headers: { 'x-user-id': userId, 'x-user-role': role, 'x-school-id': schoolId },
  });

  return ApiResponse.success(res, 200, response.data.data, 'Class students fetched successfully', response.data.meta);
});
