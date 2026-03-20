"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParentChildrenInternal = exports.getMyChildren = exports.deleteStudent = exports.updateStudent = exports.createStudent = exports.getStudentById = exports.getStudents = void 0;
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@rbschool/shared");
const env_1 = require("../config/env");
const publisher_1 = require("../events/publisher");
const ParentProfile_1 = require("../models/ParentProfile");
const Student_1 = require("../models/Student");
exports.getStudents = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const filters = { schoolId };
    if (req.query.classId)
        filters.classId = String(req.query.classId);
    if (req.query.section)
        filters.section = String(req.query.section);
    if (req.query.isActive !== undefined)
        filters.isActive = String(req.query.isActive) === 'true';
    if (req.query.search) {
        const search = String(req.query.search);
        filters.$or = [{ name: { $regex: search, $options: 'i' } }, { admissionNumber: { $regex: search, $options: 'i' } }];
    }
    const result = await Student_1.Student.paginate(filters, { page, limit, sort: { createdAt: -1 } });
    return shared_1.ApiResponse.success(res, 200, result.docs, 'Students fetched successfully', { page: result.page, limit: result.limit, total: result.totalDocs, totalPages: result.totalPages });
});
exports.getStudentById = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const student = await Student_1.Student.findOne({ _id: req.params.id, schoolId });
    if (!student)
        throw new shared_1.ApiError(404, 'Student not found');
    const classInfo = student.classId
        ? (await axios_1.default.get(`${env_1.env.ACADEMIC_SERVICE_URL}/internal/class/${student.classId}`, {
            headers: { 'x-school-id': schoolId },
        })).data.data
        : null;
    return shared_1.ApiResponse.success(res, 200, { ...student.toObject(), class: classInfo }, 'Student fetched successfully');
});
exports.createStudent = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const { name, dob, gender, classId, section, rollNumber, admissionNumber, parentPhone } = req.body;
    const exists = await Student_1.Student.findOne({ schoolId, admissionNumber });
    if (exists)
        throw new shared_1.ApiError(409, 'Admission number already exists');
    let parent = await ParentProfile_1.ParentProfile.findOne({ schoolId, phone: parentPhone });
    if (!parent) {
        const authUser = await axios_1.default.post(`${env_1.env.AUTH_SERVICE_URL}/internal/create-user`, {
            schoolId,
            role: 'parent',
            tempPassword: parentPhone.slice(-6) || 'parent123',
        });
        parent = await ParentProfile_1.ParentProfile.create({
            schoolId,
            userId: authUser.data.data.userId,
            name: `${name}'s Parent`,
            phone: parentPhone,
            childStudentIds: [],
        });
    }
    const student = await Student_1.Student.create({
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
    await (0, publisher_1.publishEvent)('student.created', {
        schoolId,
        studentId: student.id,
        parentUserId: parent.userId,
        classId: student.classId,
    });
    return shared_1.ApiResponse.success(res, 201, student, 'Student created successfully');
});
exports.updateStudent = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const student = await Student_1.Student.findOne({ _id: req.params.id, schoolId });
    if (!student)
        throw new shared_1.ApiError(404, 'Student not found');
    const previousClassId = student.classId ?? null;
    Object.assign(student, req.body);
    await student.save();
    if (previousClassId !== (student.classId ?? null)) {
        await (0, publisher_1.publishEvent)('student.classChanged', {
            schoolId,
            studentId: student.id,
            oldClassId: previousClassId,
            newClassId: student.classId,
        });
    }
    return shared_1.ApiResponse.success(res, 200, student, 'Student updated successfully');
});
exports.deleteStudent = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const student = await Student_1.Student.findOneAndUpdate({ _id: req.params.id, schoolId }, { $set: { isActive: false } }, { new: true });
    if (!student)
        throw new shared_1.ApiError(404, 'Student not found');
    await (0, publisher_1.publishEvent)('student.deleted', { schoolId, studentId: student.id, classId: student.classId });
    return shared_1.ApiResponse.success(res, 200, student, 'Student deleted successfully');
});
exports.getMyChildren = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId, schoolId } = req.user;
    const parent = await ParentProfile_1.ParentProfile.findOne({ userId, schoolId });
    if (!parent)
        throw new shared_1.ApiError(404, 'Parent profile not found');
    const children = await Student_1.Student.find({ _id: { $in: parent.childStudentIds }, schoolId, isActive: true });
    return shared_1.ApiResponse.success(res, 200, children, 'Children fetched successfully');
});
exports.getParentChildrenInternal = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.header('x-school-id') ?? req.query.schoolId ?? '');
    const parent = await ParentProfile_1.ParentProfile.findOne({ userId: req.params.parentUserId, schoolId });
    if (!parent)
        throw new shared_1.ApiError(404, 'Parent profile not found');
    const children = await Student_1.Student.find({ _id: { $in: parent.childStudentIds }, schoolId, isActive: true });
    return shared_1.ApiResponse.success(res, 200, children, 'Parent children fetched successfully');
});
