import { Request, Response } from 'express';
import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { prisma } from '../config/db';

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const schoolId = String(req.header('x-school-id') ?? req.query.schoolId ?? '');
  const [studentCount, teacherCount] = await Promise.all([
    prisma.student.count({ where: { schoolId, isActive: true } }),
    prisma.teacherProfile.count({ where: { schoolId, isActive: true } }),
  ]);
  return ApiResponse.success(res, 200, { studentCount, teacherCount }, 'Stats fetched successfully');
});

export const findUser = asyncHandler(async (req: Request, res: Response) => {
  const schoolId = String(req.query.schoolId ?? '');
  const email = req.query.email ? String(req.query.email) : null;
  const phone = req.query.phone ? String(req.query.phone) : null;
  if (!email && !phone) throw new ApiError(400, 'Email or phone is required');

  if (email) {
    const [admin, teacher] = await Promise.all([
      prisma.adminProfile.findFirst({ where: { schoolId, email } }),
      prisma.teacherProfile.findFirst({ where: { schoolId, email, isActive: true } }),
    ]);
    if (admin) return ApiResponse.success(res, 200, { userId: admin.userId, role: 'admin' }, 'User found');
    if (teacher) return ApiResponse.success(res, 200, { userId: teacher.userId, role: 'teacher' }, 'User found');
  }

  if (phone) {
    const [parent, teacher, admin] = await Promise.all([
      prisma.parentProfile.findFirst({ where: { schoolId, phone } }),
      prisma.teacherProfile.findFirst({ where: { schoolId, phone, isActive: true } }),
      prisma.adminProfile.findFirst({ where: { schoolId, phone } }),
    ]);
    if (parent) return ApiResponse.success(res, 200, { userId: parent.userId, role: 'parent' }, 'User found');
    if (teacher) return ApiResponse.success(res, 200, { userId: teacher.userId, role: 'teacher' }, 'User found');
    if (admin) return ApiResponse.success(res, 200, { userId: admin.userId, role: 'admin' }, 'User found');
  }

  throw new ApiError(404, 'User not found');
});

export const findParent = asyncHandler(async (req: Request, res: Response) => {
  const parent = await prisma.parentProfile.findFirst({ 
    where: { schoolId: String(req.query.schoolId ?? ''), phone: String(req.query.phone ?? '') } 
  });
  if (!parent) throw new ApiError(404, 'Parent not found');
  return ApiResponse.success(res, 200, parent, 'Parent found successfully');
});

export const createAdminProfile = asyncHandler(async (req: Request, res: Response) => {
  const admin = await prisma.adminProfile.create({ data: req.body });
  return ApiResponse.success(res, 201, admin, 'Admin profile created successfully');
});

export const createUserProfileInternal = asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.body as { role: 'teacher' | 'parent' };
  const data =
    role === 'teacher'
      ? await prisma.teacherProfile.create({
          data: {
            schoolId: req.body.schoolId,
            userId: req.body.userId,
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            subjects: req.body.subjects ?? [],
            assignedClassIds: req.body.assignedClassIds ?? [],
            experienceYears: req.body.experienceYears ?? 0,
            qualification: req.body.qualification,
          }
        })
      : await prisma.parentProfile.create({
          data: {
            schoolId: req.body.schoolId,
            userId: req.body.userId,
            name: req.body.name,
            phone: req.body.phone,
            childStudentIds: req.body.childStudentIds ?? [],
          }
        });

  return ApiResponse.success(res, 201, data, 'Internal profile created successfully');
});

export const getTeacherNames = asyncHandler(async (req: Request, res: Response) => {
  const ids = String(req.query.ids ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  const teachers = await prisma.teacherProfile.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, name: true }
  });
  return ApiResponse.success(res, 200, teachers, 'Teacher names fetched successfully');
});

export const getUsersByRole = asyncHandler(async (req: Request, res: Response) => {
  const schoolId = String(req.header('x-school-id') ?? req.query.schoolId ?? '');
  const roles = String(req.query.roles ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const result: Array<{ userId: string; role: string }> = [];

  if (roles.includes('admin') || roles.includes('all')) {
    const admins = await prisma.adminProfile.findMany({ where: { schoolId }, select: { userId: true } });
    result.push(...admins.map((admin) => ({ userId: admin.userId, role: 'admin' })));
  }
  if (roles.includes('teacher') || roles.includes('all')) {
    const teachers = await prisma.teacherProfile.findMany({ where: { schoolId, isActive: true }, select: { userId: true } });
    result.push(...teachers.map((teacher) => ({ userId: teacher.userId, role: 'teacher' })));
  }
  if (roles.includes('parent') || roles.includes('all')) {
    const parents = await prisma.parentProfile.findMany({ where: { schoolId }, select: { userId: true } });
    result.push(...parents.map((parent) => ({ userId: parent.userId, role: 'parent' })));
  }

  return ApiResponse.success(res, 200, result, 'Users by role fetched successfully');
});

export const getStudentParent = asyncHandler(async (req: Request, res: Response) => {
  const student = await prisma.student.findUnique({ where: { id: req.params.studentId } });
  if (!student) throw new ApiError(404, 'Student not found');

  const parent = await prisma.parentProfile.findFirst({ 
    where: { userId: student.parentUserId, schoolId: student.schoolId } 
  });
  return ApiResponse.success(res, 200, { student, parent }, 'Student parent fetched successfully');
});

export const getStudentDetailsByIds = asyncHandler(async (req: Request, res: Response) => {
  const ids = String(req.query.ids ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  const students = await prisma.student.findMany({ where: { id: { in: ids } } });
  return ApiResponse.success(res, 200, students, 'Student details fetched successfully');
});
