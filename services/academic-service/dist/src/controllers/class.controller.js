"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassStudents = exports.deleteClass = exports.updateClass = exports.createClass = exports.getClasses = void 0;
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@rbschool/shared");
const env_1 = require("../config/env");
const publisher_1 = require("../events/publisher");
const Class_1 = require("../models/Class");
exports.getClasses = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const classes = await Class_1.ClassModel.find({ schoolId }).sort({ createdAt: -1 });
    const teacherIds = [...new Set(classes.map((item) => item.teacherId).filter(Boolean))];
    const teacherNames = teacherIds.length
        ? (await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/teacher-names`, {
            params: { ids: teacherIds.join(',') },
        })).data.data
        : [];
    const teacherMap = new Map(teacherNames.map((teacher) => [teacher.userId, teacher.name]));
    return shared_1.ApiResponse.success(res, 200, classes.map((item) => ({ ...item.toObject(), teacherName: item.teacherId ? teacherMap.get(item.teacherId) ?? null : null })), 'Classes fetched successfully');
});
exports.createClass = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const exists = await Class_1.ClassModel.findOne({
        schoolId,
        name: req.body.name,
        section: req.body.section,
        academicYear: req.body.academicYear,
    });
    if (exists)
        throw new shared_1.ApiError(409, 'Class already exists');
    const classDoc = await Class_1.ClassModel.create({ ...req.body, schoolId });
    await (0, publisher_1.publishEvent)('class.created', { schoolId, classId: classDoc.id });
    return shared_1.ApiResponse.success(res, 201, classDoc, 'Class created successfully');
});
exports.updateClass = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const classDoc = await Class_1.ClassModel.findOneAndUpdate({ _id: req.params.id, schoolId }, req.body, { new: true });
    if (!classDoc)
        throw new shared_1.ApiError(404, 'Class not found');
    return shared_1.ApiResponse.success(res, 200, classDoc, 'Class updated successfully');
});
exports.deleteClass = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const classDoc = await Class_1.ClassModel.findOneAndDelete({ _id: req.params.id, schoolId });
    if (!classDoc)
        throw new shared_1.ApiError(404, 'Class not found');
    await (0, publisher_1.publishEvent)('class.deleted', { schoolId, classId: classDoc.id });
    return shared_1.ApiResponse.success(res, 200, classDoc, 'Class deleted successfully');
});
exports.getClassStudents = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId, role, schoolId } = req.user;
    const response = await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/students`, {
        params: { classId: req.params.id, page: 1, limit: 500 },
        headers: { 'x-user-id': userId, 'x-user-role': role, 'x-school-id': schoolId },
    });
    return shared_1.ApiResponse.success(res, 200, response.data.data, 'Class students fetched successfully', response.data.meta);
});
