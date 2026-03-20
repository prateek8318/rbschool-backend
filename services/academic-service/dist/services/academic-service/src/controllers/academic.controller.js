"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentResults = exports.getExamMarks = exports.uploadBulkMarks = exports.updateExam = exports.createExam = exports.listExams = exports.getClassStudents = exports.getClass = exports.deleteClass = exports.updateClass = exports.createClass = exports.listClasses = void 0;
const shared_1 = require("@rbschool/shared");
const http_1 = require("../config/http");
const publisher_1 = require("../events/publisher");
const Class_1 = require("../models/Class");
const Exam_1 = require("../models/Exam");
const Marks_1 = require("../models/Marks");
const grade_1 = require("../utils/grade");
const internalHeaders = (req) => ({
    "x-user-id": req.user?.userId ?? "",
    "x-school-id": req.user?.schoolId ?? "",
    "x-user-role": req.user?.role ?? "",
});
exports.listClasses = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const query = { school_id: req.user?.schoolId };
    if (req.query.teacher_id) {
        query.teacher_id = String(req.query.teacher_id);
    }
    const classes = await Class_1.ClassModel.find(query).sort({ createdAt: -1 });
    res.json(new shared_1.ApiResponse(200, classes, "Classes fetched successfully"));
});
exports.createClass = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const newClass = await Class_1.ClassModel.create({
        ...req.body,
        school_id: req.user?.schoolId,
    });
    res.status(201).json(new shared_1.ApiResponse(201, newClass, "Class created successfully"));
});
exports.updateClass = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const updatedClass = await Class_1.ClassModel.findOneAndUpdate({ _id: req.params.id, school_id: req.user?.schoolId }, req.body, { new: true, runValidators: true });
    if (!updatedClass) {
        throw new shared_1.ApiError(404, "Class not found");
    }
    res.json(new shared_1.ApiResponse(200, updatedClass, "Class updated successfully"));
});
exports.deleteClass = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const deletedClass = await Class_1.ClassModel.findOneAndDelete({
        _id: req.params.id,
        school_id: req.user?.schoolId,
    });
    if (!deletedClass) {
        throw new shared_1.ApiError(404, "Class not found");
    }
    await (0, publisher_1.publishEvent)("class.deleted", {
        classId: String(deletedClass._id),
        schoolId: deletedClass.school_id,
    });
    res.json(new shared_1.ApiResponse(200, deletedClass, "Class deleted successfully"));
});
exports.getClass = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const classDoc = await Class_1.ClassModel.findOne({
        _id: req.params.id,
        school_id: req.user?.schoolId,
    });
    if (!classDoc) {
        throw new shared_1.ApiError(404, "Class not found");
    }
    res.json(new shared_1.ApiResponse(200, classDoc, "Class fetched successfully"));
});
exports.getClassStudents = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const response = await http_1.userHttpClient.get("/students", {
        headers: internalHeaders(req),
        params: { class_id: req.params.id, limit: 1000, page: 1 },
    });
    res.json(new shared_1.ApiResponse(200, response.data.data, "Class students fetched successfully"));
});
exports.listExams = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const query = { school_id: req.user?.schoolId };
    if (req.query.class_id) {
        query.class_ids = { $in: [String(req.query.class_id)] };
    }
    const exams = await Exam_1.Exam.find(query).sort({ start_date: -1 });
    res.json(new shared_1.ApiResponse(200, exams, "Exams fetched successfully"));
});
exports.createExam = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const exam = await Exam_1.Exam.create({
        ...req.body,
        school_id: req.user?.schoolId,
    });
    await (0, publisher_1.publishEvent)("exam.published", {
        examId: String(exam._id),
        classIds: exam.class_ids,
        schoolId: exam.school_id,
    });
    res.status(201).json(new shared_1.ApiResponse(201, exam, "Exam created successfully"));
});
exports.updateExam = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const exam = await Exam_1.Exam.findOneAndUpdate({ _id: req.params.id, school_id: req.user?.schoolId }, req.body, { new: true, runValidators: true });
    if (!exam) {
        throw new shared_1.ApiError(404, "Exam not found");
    }
    res.json(new shared_1.ApiResponse(200, exam, "Exam updated successfully"));
});
exports.uploadBulkMarks = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const exam = await Exam_1.Exam.findOne({ _id: req.params.id, school_id: req.user?.schoolId });
    if (!exam) {
        throw new shared_1.ApiError(404, "Exam not found");
    }
    const marksPayload = req.body.marks_data.map((item) => {
        const marksObtained = Number(item.marks_obtained);
        const maxMarks = Number(item.max_marks ?? exam.max_marks);
        const grade = (0, grade_1.calculateGrade)((marksObtained / maxMarks) * 100);
        return {
            school_id: req.user?.schoolId,
            exam_id: String(exam._id),
            student_id: String(item.student_id),
            class_id: String(item.class_id),
            subject: String(item.subject),
            marks_obtained: marksObtained,
            max_marks: maxMarks,
            grade,
            rank: item.rank ? Number(item.rank) : undefined,
            entered_by: req.user?.userId ?? "",
        };
    });
    const operations = marksPayload.map((item) => ({
        updateOne: {
            filter: {
                school_id: item.school_id,
                exam_id: item.exam_id,
                student_id: item.student_id,
                subject: item.subject,
            },
            update: { $set: item },
            upsert: true,
        },
    }));
    await Marks_1.Marks.bulkWrite(operations);
    await (0, publisher_1.publishEvent)("marks.uploaded", {
        examId: String(exam._id),
        studentIds: marksPayload.map((item) => item.student_id),
        schoolId: req.user?.schoolId,
    });
    res.json(new shared_1.ApiResponse(200, { count: marksPayload.length }, "Marks uploaded successfully"));
});
exports.getExamMarks = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const marks = await Marks_1.Marks.find({
        school_id: req.user?.schoolId,
        exam_id: req.params.id,
    }).sort({ student_id: 1, subject: 1 });
    res.json(new shared_1.ApiResponse(200, marks, "Exam marks fetched successfully"));
});
exports.getStudentResults = (0, shared_1.asyncHandler)(async (req, res, _next) => {
    const marks = await Marks_1.Marks.find({
        school_id: req.user?.schoolId,
        student_id: req.params.id,
    }).sort({ createdAt: -1 });
    const examIds = [...new Set(marks.map((mark) => mark.exam_id))];
    const exams = await Exam_1.Exam.find({ _id: { $in: examIds } });
    const examMap = new Map(exams.map((exam) => [String(exam._id), exam]));
    const results = marks.map((mark) => ({
        ...mark.toObject(),
        exam: examMap.get(mark.exam_id) ?? null,
    }));
    res.json(new shared_1.ApiResponse(200, results, "Student results fetched successfully"));
});
