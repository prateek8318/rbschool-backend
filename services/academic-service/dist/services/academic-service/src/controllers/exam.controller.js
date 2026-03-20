"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentExamsInternal = exports.getClassesByIdsInternal = exports.getTeacherClassesInternal = exports.getClassInternal = exports.getExamResultsSummary = exports.getStudentResults = exports.getMarksSheet = exports.bulkUploadMarks = exports.deleteExam = exports.updateExam = exports.createExam = exports.getExams = void 0;
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@rbschool/shared");
const env_1 = require("../config/env");
const publisher_1 = require("../events/publisher");
const Class_1 = require("../models/Class");
const Exam_1 = require("../models/Exam");
const Marks_1 = require("../models/Marks");
const gradeCalculator_1 = require("../utils/gradeCalculator");
const computeStatus = (startDate, endDate) => {
    const now = new Date();
    if (now < startDate)
        return 'upcoming';
    if (now > endDate)
        return 'completed';
    return 'ongoing';
};
exports.getExams = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const query = { schoolId };
    if (req.query.classId)
        query.classIds = String(req.query.classId);
    const exams = await Exam_1.Exam.find(query).sort({ startDate: -1 });
    for (const exam of exams) {
        exam.status = computeStatus(exam.startDate, exam.endDate);
        await exam.save();
    }
    return shared_1.ApiResponse.success(res, 200, exams, 'Exams fetched successfully');
});
exports.createExam = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const exam = await Exam_1.Exam.create({
        ...req.body,
        schoolId,
        status: computeStatus(new Date(req.body.startDate), new Date(req.body.endDate)),
    });
    await (0, publisher_1.publishEvent)('exam.created', { schoolId, examId: exam.id, examName: exam.name, classIds: exam.classIds, startDate: exam.startDate });
    return shared_1.ApiResponse.success(res, 201, exam, 'Exam created successfully');
});
exports.updateExam = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const payload = { ...req.body };
    if (payload.startDate || payload.endDate) {
        payload.status = computeStatus(new Date(payload.startDate ?? new Date()), new Date(payload.endDate ?? new Date()));
    }
    const exam = await Exam_1.Exam.findOneAndUpdate({ _id: req.params.id, schoolId }, payload, { new: true });
    if (!exam)
        throw new shared_1.ApiError(404, 'Exam not found');
    return shared_1.ApiResponse.success(res, 200, exam, 'Exam updated successfully');
});
exports.deleteExam = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const exam = await Exam_1.Exam.findOneAndDelete({ _id: req.params.id, schoolId });
    if (!exam)
        throw new shared_1.ApiError(404, 'Exam not found');
    await Marks_1.Marks.deleteMany({ examId: exam.id });
    return shared_1.ApiResponse.success(res, 200, exam, 'Exam deleted successfully');
});
exports.bulkUploadMarks = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId, role, schoolId } = req.user;
    if (role !== 'teacher')
        throw new shared_1.ApiError(403, 'Only teachers can upload marks');
    const exam = await Exam_1.Exam.findOne({ _id: req.params.examId, schoolId });
    if (!exam)
        throw new shared_1.ApiError(404, 'Exam not found');
    const { classId, marks } = req.body;
    const classDoc = await Class_1.ClassModel.findOne({ _id: classId, schoolId });
    if (!classDoc || classDoc.teacherId !== userId)
        throw new shared_1.ApiError(403, 'You are not assigned to this class');
    for (const entry of marks) {
        await Marks_1.Marks.findOneAndUpdate({ examId: exam.id, studentId: entry.studentId, subject: entry.subject }, {
            schoolId,
            examId: exam.id,
            studentId: entry.studentId,
            classId,
            subject: entry.subject,
            marksObtained: entry.marksObtained,
            maxMarks: exam.maxMarks,
            grade: (0, gradeCalculator_1.getGrade)(entry.marksObtained, exam.maxMarks),
            enteredBy: userId,
        }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    const totals = await Marks_1.Marks.aggregate([
        { $match: { examId: exam.id, classId } },
        { $group: { _id: '$studentId', total: { $sum: '$marksObtained' } } },
    ]);
    const ranked = (0, gradeCalculator_1.calculateRanks)(totals.map((item) => ({ studentId: item._id, total: item.total })));
    for (const item of ranked) {
        await Marks_1.Marks.updateMany({ examId: exam.id, classId, studentId: item.studentId }, { $set: { rank: item.rank } });
    }
    await (0, publisher_1.publishEvent)('marks.uploaded', { schoolId, examId: exam.id, examName: exam.name, classId });
    return shared_1.ApiResponse.success(res, 200, { uploaded: marks.length }, 'Marks uploaded successfully');
});
exports.getMarksSheet = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const records = await Marks_1.Marks.find({ examId: req.params.id, classId: String(req.query.classId), schoolId }).sort({ studentId: 1 });
    const grouped = new Map();
    records.forEach((record) => {
        const current = grouped.get(record.studentId) ?? {
            studentId: record.studentId,
            subjects: {},
            total: 0,
            rank: record.rank,
            grade: record.grade,
        };
        current.subjects[record.subject] = record.marksObtained;
        current.total += record.marksObtained;
        current.rank = record.rank;
        grouped.set(record.studentId, current);
    });
    return shared_1.ApiResponse.success(res, 200, Array.from(grouped.values()), 'Marksheet fetched successfully');
});
exports.getStudentResults = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const records = await Marks_1.Marks.find({ studentId: req.params.id, schoolId }).sort({ createdAt: -1 });
    return shared_1.ApiResponse.success(res, 200, records, 'Student results fetched successfully');
});
exports.getExamResultsSummary = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const exam = await Exam_1.Exam.findOne({ _id: req.params.id, schoolId });
    if (!exam)
        throw new shared_1.ApiError(404, 'Exam not found');
    const marks = await Marks_1.Marks.find({ examId: exam.id, schoolId });
    const grouped = new Map();
    marks.forEach((record) => {
        const classMap = grouped.get(record.classId) ?? new Map();
        const student = classMap.get(record.studentId) ?? { total: 0, count: 0, rank: record.rank };
        student.total += record.marksObtained;
        student.count += 1;
        student.rank = record.rank ?? student.rank;
        classMap.set(record.studentId, student);
        grouped.set(record.classId, classMap);
    });
    const classIds = Array.from(grouped.keys());
    const studentIds = Array.from(new Set(Array.from(grouped.values()).flatMap((classMap) => Array.from(classMap.keys()))));
    const [classes, studentResponse] = await Promise.all([
        classIds.length ? Class_1.ClassModel.find({ _id: { $in: classIds }, schoolId }) : Promise.resolve([]),
        studentIds.length
            ? axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/student-details`, { params: { ids: studentIds.join(',') } })
            : Promise.resolve({ data: { data: [] } }),
    ]);
    const classMap = new Map(classes.map((item) => [
        item._id.toString(),
        `${item.name}${item.section ? `-${item.section}` : ''}`,
    ]));
    const studentMap = new Map(studentResponse.data.data.map((student) => [student._id, student.name]));
    const subjectCount = Math.max(exam.subjects.length, 1);
    const totalMaxMarks = exam.maxMarks * subjectCount;
    const summary = Array.from(grouped.entries()).map(([classId, students]) => {
        const studentSummaries = Array.from(students.entries()).map(([studentId, item]) => ({
            studentId,
            studentName: studentMap.get(studentId) ?? 'Unknown',
            total: item.total,
            percentage: Number(((item.total / totalMaxMarks) * 100).toFixed(2)),
            rank: item.rank ?? Number.MAX_SAFE_INTEGER,
        }));
        const topper = [...studentSummaries].sort((a, b) => a.rank - b.rank || b.total - a.total)[0] ?? null;
        const averageMarks = studentSummaries.length
            ? Number((studentSummaries.reduce((sum, item) => sum + item.total, 0) / studentSummaries.length).toFixed(2))
            : 0;
        const passedCount = studentSummaries.filter((item) => item.percentage >= 40).length;
        const failCount = studentSummaries.length - passedCount;
        return {
            classId,
            className: classMap.get(classId) ?? classId,
            topper: topper
                ? {
                    studentId: topper.studentId,
                    studentName: topper.studentName,
                    total: topper.total,
                    percentage: topper.percentage,
                    rank: topper.rank,
                }
                : null,
            average: averageMarks,
            passPercentage: studentSummaries.length ? Number(((passedCount / studentSummaries.length) * 100).toFixed(2)) : 0,
            failPercentage: studentSummaries.length ? Number(((failCount / studentSummaries.length) * 100).toFixed(2)) : 0,
            passCount: passedCount,
            failCount,
            totalStudents: studentSummaries.length,
        };
    });
    return shared_1.ApiResponse.success(res, 200, summary, 'Exam results summary fetched successfully');
});
exports.getClassInternal = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.header('x-school-id') ?? '');
    const classDoc = await Class_1.ClassModel.findOne({ _id: req.params.id, schoolId });
    if (!classDoc)
        throw new shared_1.ApiError(404, 'Class not found');
    return shared_1.ApiResponse.success(res, 200, classDoc, 'Class fetched successfully');
});
exports.getTeacherClassesInternal = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.header('x-school-id') ?? '');
    const classes = await Class_1.ClassModel.find({ schoolId, teacherId: req.params.teacherId });
    return shared_1.ApiResponse.success(res, 200, classes, 'Teacher classes fetched successfully');
});
exports.getClassesByIdsInternal = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.header('x-school-id') ?? '');
    const ids = String(req.query.ids ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    const classes = await Class_1.ClassModel.find({ _id: { $in: ids }, schoolId });
    return shared_1.ApiResponse.success(res, 200, classes, 'Classes fetched successfully');
});
exports.getStudentExamsInternal = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = String(req.header('x-school-id') ?? '');
    const studentResponse = await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/student-details`, {
        params: { ids: req.params.studentId },
    });
    const student = studentResponse.data.data[0];
    const exams = student?.classId ? await Exam_1.Exam.find({ schoolId, classIds: student.classId, status: 'upcoming' }) : [];
    return shared_1.ApiResponse.success(res, 200, exams, 'Student exams fetched successfully');
});
