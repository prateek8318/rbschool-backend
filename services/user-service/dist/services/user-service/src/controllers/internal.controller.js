"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentDetailsByIds = exports.getStudentParent = exports.getUsersByRole = exports.getTeacherNames = exports.createUserProfileInternal = exports.createAdminProfile = exports.findParent = exports.findUser = exports.getStats = void 0;
const shared_1 = require("@rbschool/shared");
const AdminProfile_1 = require("../models/AdminProfile");
const ParentProfile_1 = require("../models/ParentProfile");
const Student_1 = require("../models/Student");
const TeacherProfile_1 = require("../models/TeacherProfile");
exports.getStats = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.header('x-school-id') ?? req.query.schoolId ?? '');
    const [studentCount, teacherCount] = await Promise.all([
        Student_1.Student.countDocuments({ schoolId, isActive: true }),
        TeacherProfile_1.TeacherProfile.countDocuments({ schoolId, isActive: true }),
    ]);
    return shared_1.ApiResponse.success(res, 200, { studentCount, teacherCount }, 'Stats fetched successfully');
});
exports.findUser = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.query.schoolId ?? '');
    const email = req.query.email ? String(req.query.email) : null;
    const phone = req.query.phone ? String(req.query.phone) : null;
    if (!email && !phone)
        throw new shared_1.ApiError(400, 'Email or phone is required');
    if (email) {
        const [admin, teacher] = await Promise.all([
            AdminProfile_1.AdminProfile.findOne({ schoolId, email }),
            TeacherProfile_1.TeacherProfile.findOne({ schoolId, email, isActive: true }),
        ]);
        if (admin)
            return shared_1.ApiResponse.success(res, 200, { userId: admin.userId, role: 'admin' }, 'User found');
        if (teacher)
            return shared_1.ApiResponse.success(res, 200, { userId: teacher.userId, role: 'teacher' }, 'User found');
    }
    if (phone) {
        const [parent, teacher, admin] = await Promise.all([
            ParentProfile_1.ParentProfile.findOne({ schoolId, phone }),
            TeacherProfile_1.TeacherProfile.findOne({ schoolId, phone, isActive: true }),
            AdminProfile_1.AdminProfile.findOne({ schoolId, phone }),
        ]);
        if (parent)
            return shared_1.ApiResponse.success(res, 200, { userId: parent.userId, role: 'parent' }, 'User found');
        if (teacher)
            return shared_1.ApiResponse.success(res, 200, { userId: teacher.userId, role: 'teacher' }, 'User found');
        if (admin)
            return shared_1.ApiResponse.success(res, 200, { userId: admin.userId, role: 'admin' }, 'User found');
    }
    throw new shared_1.ApiError(404, 'User not found');
});
exports.findParent = (0, shared_1.asyncHandler)(async (req, res) => {
    const parent = await ParentProfile_1.ParentProfile.findOne({ schoolId: String(req.query.schoolId ?? ''), phone: String(req.query.phone ?? '') });
    if (!parent)
        throw new shared_1.ApiError(404, 'Parent not found');
    return shared_1.ApiResponse.success(res, 200, parent, 'Parent found successfully');
});
exports.createAdminProfile = (0, shared_1.asyncHandler)(async (req, res) => {
    const admin = await AdminProfile_1.AdminProfile.create(req.body);
    return shared_1.ApiResponse.success(res, 201, admin, 'Admin profile created successfully');
});
exports.createUserProfileInternal = (0, shared_1.asyncHandler)(async (req, res) => {
    const { role } = req.body;
    const data = role === 'teacher'
        ? await TeacherProfile_1.TeacherProfile.create({
            schoolId: req.body.schoolId,
            userId: req.body.userId,
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            subjects: req.body.subjects ?? [],
            assignedClassIds: req.body.assignedClassIds ?? [],
            experienceYears: req.body.experienceYears ?? 0,
            qualification: req.body.qualification,
        })
        : await ParentProfile_1.ParentProfile.create({
            schoolId: req.body.schoolId,
            userId: req.body.userId,
            name: req.body.name,
            phone: req.body.phone,
            childStudentIds: req.body.childStudentIds ?? [],
        });
    return shared_1.ApiResponse.success(res, 201, data, 'Internal profile created successfully');
});
exports.getTeacherNames = (0, shared_1.asyncHandler)(async (req, res) => {
    const ids = String(req.query.ids ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    const teachers = await TeacherProfile_1.TeacherProfile.find({ userId: { $in: ids } }, { userId: 1, name: 1 });
    return shared_1.ApiResponse.success(res, 200, teachers, 'Teacher names fetched successfully');
});
exports.getUsersByRole = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.header('x-school-id') ?? req.query.schoolId ?? '');
    const roles = String(req.query.roles ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    const result = [];
    if (roles.includes('admin') || roles.includes('all')) {
        const admins = await AdminProfile_1.AdminProfile.find({ schoolId }, { userId: 1 });
        result.push(...admins.map((admin) => ({ userId: admin.userId, role: 'admin' })));
    }
    if (roles.includes('teacher') || roles.includes('all')) {
        const teachers = await TeacherProfile_1.TeacherProfile.find({ schoolId, isActive: true }, { userId: 1 });
        result.push(...teachers.map((teacher) => ({ userId: teacher.userId, role: 'teacher' })));
    }
    if (roles.includes('parent') || roles.includes('all')) {
        const parents = await ParentProfile_1.ParentProfile.find({ schoolId }, { userId: 1 });
        result.push(...parents.map((parent) => ({ userId: parent.userId, role: 'parent' })));
    }
    return shared_1.ApiResponse.success(res, 200, result, 'Users by role fetched successfully');
});
exports.getStudentParent = (0, shared_1.asyncHandler)(async (req, res) => {
    const student = await Student_1.Student.findById(req.params.studentId);
    if (!student)
        throw new shared_1.ApiError(404, 'Student not found');
    const parent = await ParentProfile_1.ParentProfile.findOne({ userId: student.parentUserId, schoolId: student.schoolId });
    return shared_1.ApiResponse.success(res, 200, { student, parent }, 'Student parent fetched successfully');
});
exports.getStudentDetailsByIds = (0, shared_1.asyncHandler)(async (req, res) => {
    const ids = String(req.query.ids ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    const students = await Student_1.Student.find({ _id: { $in: ids } });
    return shared_1.ApiResponse.success(res, 200, students, 'Student details fetched successfully');
});
