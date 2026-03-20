import axios from 'axios';
import { FilterQuery } from 'mongoose';
import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { env } from '../config/env';
import { publishEvent } from '../events/publisher';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ParentProfile } from '../models/ParentProfile';
import { IStudent, Student } from '../models/Student';

export const getStudents = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const filters: FilterQuery<IStudent> = { schoolId };

  if (req.query.classId) filters.classId = String(req.query.classId);
  if (req.query.section) filters.section = String(req.query.section);
  if (req.query.status) {
    const status = String(req.query.status).toLowerCase();
    if (status === 'active') filters.isActive = true;
    if (status === 'inactive') filters.isActive = false;
  } else if (req.query.isActive !== undefined) {
    filters.isActive = String(req.query.isActive) === 'true';
  }
  if (req.query.search) {
    const search = String(req.query.search);
    filters.$or = [{ name: { $regex: search, $options: 'i' } }, { admissionNumber: { $regex: search, $options: 'i' } }];
  }

  const [students, total] = await Promise.all([
    Student.find(filters)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Student.countDocuments(filters),
  ]);

  return ApiResponse.success(
    res,
    200,
    students,
    'Students fetched successfully',
    { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  );
});

export const getStudentById = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const student = await Student.findOne({ _id: req.params.id, schoolId });
  if (!student) throw new ApiError(404, 'Student not found');

  const classInfo = student.classId
    ? (await axios.get(`${env.ACADEMIC_SERVICE_URL}/internal/class/${student.classId}`, {
        headers: { 'x-school-id': schoolId },
      })).data.data
    : null;

  return ApiResponse.success(res, 200, { ...student.toObject(), class: classInfo }, 'Student fetched successfully');
});

export const createStudent = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const {
    name: rawName,
    firstName,
    lastName,
    dob,
    gender,
    classId,
    section,
    rollNumber,
    admissionNumber,
    parentPhone,
  } = req.body as Record<string, string>;
  const name = rawName ?? [firstName, lastName].filter(Boolean).join(' ').trim();

  if (!name) throw new ApiError(400, 'Student name is required');

  const exists = await Student.findOne({ schoolId, admissionNumber });
  if (exists) throw new ApiError(409, 'Admission number already exists');

  let parent = await ParentProfile.findOne({ schoolId, phone: parentPhone });
  if (!parent) {
    const authUser = await axios.post(`${env.AUTH_SERVICE_URL}/internal/create-user`, {
      schoolId,
      role: 'parent',
      tempPassword: parentPhone.slice(-6) || 'parent123',
    });

    parent = await ParentProfile.create({
      schoolId,
      userId: authUser.data.data.userId,
      name: `${name}'s Parent`,
      phone: parentPhone,
      childStudentIds: [],
    });
  }

  const student = await Student.create({
    schoolId,
    name,
    dob,
    gender,
    classId,
    section,
    rollNumber,
    admissionNumber,
    parentUserId: parent.userId,
  });

  parent.childStudentIds.push(student.id);
  await parent.save();

  await publishEvent('student.created', {
    schoolId,
    studentId: student.id,
    parentUserId: parent.userId,
    classId: student.classId,
  });

  return ApiResponse.success(res, 201, student, 'Student created successfully');
});

export const updateStudent = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const student = await Student.findOne({ _id: req.params.id, schoolId });
  if (!student) throw new ApiError(404, 'Student not found');

  const previousClassId = student.classId ?? null;
  Object.assign(student, req.body);
  await student.save();

  if (previousClassId !== (student.classId ?? null)) {
    await publishEvent('student.classChanged', {
      schoolId,
      studentId: student.id,
      oldClassId: previousClassId,
      newClassId: student.classId,
    });
  }

  return ApiResponse.success(res, 200, student, 'Student updated successfully');
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const student = await Student.findOneAndUpdate(
    { _id: req.params.id, schoolId },
    { $set: { isActive: false } },
    { new: true },
  );
  if (!student) throw new ApiError(404, 'Student not found');

  await publishEvent('student.deleted', { schoolId, studentId: student.id, classId: student.classId });
  return ApiResponse.success(res, 200, student, 'Student deleted successfully');
});

export const getMyChildren = asyncHandler(async (req, res) => {
  const { userId, schoolId } = (req as AuthenticatedRequest).user;
  const parent = await ParentProfile.findOne({ userId, schoolId });
  if (!parent) throw new ApiError(404, 'Parent profile not found');

  const children = await Student.find({ _id: { $in: parent.childStudentIds }, schoolId, isActive: true });
  return ApiResponse.success(res, 200, children, 'Children fetched successfully');
});

export const getParentChildrenInternal = asyncHandler(async (req, res) => {
  const schoolId = String(req.header('x-school-id') ?? req.query.schoolId ?? '');
  const parent = await ParentProfile.findOne({ userId: req.params.parentUserId, schoolId });
  if (!parent) throw new ApiError(404, 'Parent profile not found');

  const children = await Student.find({ _id: { $in: parent.childStudentIds }, schoolId, isActive: true });
  return ApiResponse.success(res, 200, children, 'Parent children fetched successfully');
});

export const exportStudents = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const format = String(req.query.format ?? 'csv').toLowerCase();
  if (format !== 'csv') throw new ApiError(400, 'Only csv export is supported');

  const filters: FilterQuery<IStudent> = { schoolId };
  if (req.query.classId) filters.classId = String(req.query.classId);
  if (req.query.section) filters.section = String(req.query.section);
  if (req.query.status) {
    const status = String(req.query.status).toLowerCase();
    if (status === 'active') filters.isActive = true;
    if (status === 'inactive') filters.isActive = false;
  }

  const students = await Student.find(filters).sort({ name: 1, rollNumber: 1 });
  const rows = [
    ['Student Name', 'Admission Number', 'Roll Number', 'Class ID', 'Section', 'Gender', 'Date Of Birth', 'Status'],
    ...students.map((student) => [
      student.name,
      student.admissionNumber,
      student.rollNumber,
      student.classId ?? '',
      student.section ?? '',
      student.gender,
      new Date(student.dob).toISOString().slice(0, 10),
      student.isActive ? 'active' : 'inactive',
    ]),
  ];

  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="students-export.csv"');
  res.status(200).send(csv);
});
