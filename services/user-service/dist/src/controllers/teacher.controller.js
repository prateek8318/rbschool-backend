"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignClasses = exports.deleteTeacher = exports.updateTeacher = exports.createTeacher = exports.getTeacherById = exports.getTeachers = void 0;
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@rbschool/shared");
const env_1 = require("../config/env");
const TeacherProfile_1 = require("../models/TeacherProfile");
exports.getTeachers = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const result = await TeacherProfile_1.TeacherProfile.paginate({ schoolId, isActive: true }, { page, limit, sort: { createdAt: -1 } });
    return shared_1.ApiResponse.success(res, 200, result.docs, 'Teachers fetched successfully', { page: result.page, limit: result.limit, total: result.totalDocs, totalPages: result.totalPages });
});
exports.getTeacherById = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const teacher = await TeacherProfile_1.TeacherProfile.findOne({ _id: req.params.id, schoolId });
    if (!teacher)
        throw new shared_1.ApiError(404, 'Teacher not found');
    const classes = teacher.assignedClassIds.length
        ? (await axios_1.default.get(`${env_1.env.ACADEMIC_SERVICE_URL}/internal/classes-by-ids`, {
            params: { ids: teacher.assignedClassIds.join(',') },
            headers: { 'x-school-id': schoolId },
        })).data.data
        : [];
    return shared_1.ApiResponse.success(res, 200, { ...teacher.toObject(), classes }, 'Teacher fetched successfully');
});
exports.createTeacher = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const { name, email, phone, subjects, experienceYears, qualification } = req.body;
    const tempPassword = `Teach@${phone.slice(-4) || '1234'}`;
    const authResponse = await axios_1.default.post(`${env_1.env.AUTH_SERVICE_URL}/internal/create-user`, {
        email,
        phone,
        role: 'teacher',
        schoolId,
        tempPassword,
    });
    const teacher = await TeacherProfile_1.TeacherProfile.create({
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
    return shared_1.ApiResponse.success(res, 201, { teacher, tempPassword }, 'Teacher created successfully');
});
exports.updateTeacher = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const teacher = await TeacherProfile_1.TeacherProfile.findOneAndUpdate({ _id: req.params.id, schoolId }, req.body, { new: true });
    if (!teacher)
        throw new shared_1.ApiError(404, 'Teacher not found');
    return shared_1.ApiResponse.success(res, 200, teacher, 'Teacher updated successfully');
});
exports.deleteTeacher = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const teacher = await TeacherProfile_1.TeacherProfile.findOneAndUpdate({ _id: req.params.id, schoolId }, { $set: { isActive: false } }, { new: true });
    if (!teacher)
        throw new shared_1.ApiError(404, 'Teacher not found');
    return shared_1.ApiResponse.success(res, 200, teacher, 'Teacher deleted successfully');
});
exports.assignClasses = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const teacher = await TeacherProfile_1.TeacherProfile.findOneAndUpdate({ _id: req.params.id, schoolId }, { $set: { assignedClassIds: req.body.classIds } }, { new: true });
    if (!teacher)
        throw new shared_1.ApiError(404, 'Teacher not found');
    return shared_1.ApiResponse.success(res, 200, teacher, 'Classes assigned successfully');
});
