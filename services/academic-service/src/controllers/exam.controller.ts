import axios from 'axios';
import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { env } from '../config/env';
import { publishEvent } from '../events/publisher';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ClassModel } from '../models/Class';
import { Exam } from '../models/Exam';
import { Marks } from '../models/Marks';
import { calculateRanks, getGrade } from '../utils/gradeCalculator';

const computeStatus = (startDate: Date, endDate: Date): 'upcoming' | 'ongoing' | 'completed' => {
  const now = new Date();
  if (now < startDate) return 'upcoming';
  if (now > endDate) return 'completed';
  return 'ongoing';
};

export const getExams = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const query: Record<string, unknown> = { schoolId };
  if (req.query.classId) query.classIds = String(req.query.classId);

  const exams = await Exam.find(query).sort({ startDate: -1 });
  for (const exam of exams) {
    exam.status = computeStatus(exam.startDate, exam.endDate);
    await exam.save();
  }

  return ApiResponse.success(res, 200, exams, 'Exams fetched successfully');
});

export const createExam = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const exam = await Exam.create({
    ...req.body,
    schoolId,
    status: computeStatus(new Date(req.body.startDate), new Date(req.body.endDate)),
  });
  await publishEvent('exam.created', { schoolId, examId: exam.id, examName: exam.name, classIds: exam.classIds, startDate: exam.startDate });
  return ApiResponse.success(res, 201, exam, 'Exam created successfully');
});

export const updateExam = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const payload = { ...req.body };
  if (payload.startDate || payload.endDate) {
    payload.status = computeStatus(new Date(payload.startDate ?? new Date()), new Date(payload.endDate ?? new Date()));
  }
  const exam = await Exam.findOneAndUpdate({ _id: req.params.id, schoolId }, payload, { new: true });
  if (!exam) throw new ApiError(404, 'Exam not found');
  return ApiResponse.success(res, 200, exam, 'Exam updated successfully');
});

export const deleteExam = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const exam = await Exam.findOneAndDelete({ _id: req.params.id, schoolId });
  if (!exam) throw new ApiError(404, 'Exam not found');
  await Marks.deleteMany({ examId: exam.id });
  return ApiResponse.success(res, 200, exam, 'Exam deleted successfully');
});

export const bulkUploadMarks = asyncHandler(async (req, res) => {
  const { userId, role, schoolId } = (req as AuthenticatedRequest).user;
  if (role !== 'teacher') throw new ApiError(403, 'Only teachers can upload marks');

  const exam = await Exam.findOne({ _id: req.params.examId, schoolId });
  if (!exam) throw new ApiError(404, 'Exam not found');

  const { classId, marks } = req.body as { classId: string; marks: Array<{ studentId: string; subject: string; marksObtained: number }> };
  const classDoc = await ClassModel.findOne({ _id: classId, schoolId });
  if (!classDoc || classDoc.teacherId !== userId) throw new ApiError(403, 'You are not assigned to this class');

  for (const entry of marks) {
    await Marks.findOneAndUpdate(
      { examId: exam.id, studentId: entry.studentId, subject: entry.subject },
      {
        schoolId,
        examId: exam.id,
        studentId: entry.studentId,
        classId,
        subject: entry.subject,
        marksObtained: entry.marksObtained,
        maxMarks: exam.maxMarks,
        grade: getGrade(entry.marksObtained, exam.maxMarks),
        enteredBy: userId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  const totals = await Marks.aggregate([
    { $match: { examId: exam.id, classId } },
    { $group: { _id: '$studentId', total: { $sum: '$marksObtained' } } },
  ]);
  const ranked = calculateRanks(totals.map((item) => ({ studentId: item._id as string, total: item.total as number })));

  for (const item of ranked) {
    await Marks.updateMany({ examId: exam.id, classId, studentId: item.studentId }, { $set: { rank: item.rank } });
  }

  await publishEvent('marks.uploaded', { schoolId, examId: exam.id, examName: exam.name, classId });
  return ApiResponse.success(res, 200, { uploaded: marks.length }, 'Marks uploaded successfully');
});

export const getMarksSheet = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const records = await Marks.find({ examId: req.params.id, classId: String(req.query.classId), schoolId }).sort({ studentId: 1 });
  const grouped = new Map<string, { studentId: string; subjects: Record<string, number>; total: number; rank?: number; grade: string }>();

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

  return ApiResponse.success(res, 200, Array.from(grouped.values()), 'Marksheet fetched successfully');
});

export const getStudentResults = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const records = await Marks.find({ studentId: req.params.id, schoolId }).sort({ createdAt: -1 });
  return ApiResponse.success(res, 200, records, 'Student results fetched successfully');
});

export const getExamResultsSummary = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const exam = await Exam.findOne({ _id: req.params.id, schoolId });
  if (!exam) throw new ApiError(404, 'Exam not found');

  const marks = await Marks.find({ examId: exam.id, schoolId });
  const grouped = new Map<string, Map<string, { total: number; count: number; rank?: number }>>();

  marks.forEach((record) => {
    const classMap = grouped.get(record.classId) ?? new Map<string, { total: number; count: number; rank?: number }>();
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
    classIds.length ? ClassModel.find({ _id: { $in: classIds }, schoolId }) : Promise.resolve([]),
    studentIds.length
      ? axios.get(`${env.USER_SERVICE_URL}/internal/student-details`, { params: { ids: studentIds.join(',') } })
      : Promise.resolve({ data: { data: [] } }),
  ]);

  const classMap = new Map(
    classes.map((item) => [
      item._id.toString(),
      `${item.name}${item.section ? `-${item.section}` : ''}`,
    ]),
  );
  const studentMap = new Map((studentResponse.data.data as Array<{ _id: string; name: string }>).map((student) => [student._id, student.name]));
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

  return ApiResponse.success(res, 200, summary, 'Exam results summary fetched successfully');
});

export const getClassInternal = asyncHandler(async (req, res) => {
  const schoolId = String(req.header('x-school-id') ?? '');
  const classDoc = await ClassModel.findOne({ _id: req.params.id, schoolId });
  if (!classDoc) throw new ApiError(404, 'Class not found');
  return ApiResponse.success(res, 200, classDoc, 'Class fetched successfully');
});

export const getTeacherClassesInternal = asyncHandler(async (req, res) => {
  const schoolId = String(req.header('x-school-id') ?? '');
  const classes = await ClassModel.find({ schoolId, teacherId: req.params.teacherId });
  return ApiResponse.success(res, 200, classes, 'Teacher classes fetched successfully');
});

export const getClassesByIdsInternal = asyncHandler(async (req, res) => {
  const schoolId = String(req.header('x-school-id') ?? '');
  const ids = String(req.query.ids ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const classes = await ClassModel.find({ _id: { $in: ids }, schoolId });
  return ApiResponse.success(res, 200, classes, 'Classes fetched successfully');
});

export const getStudentExamsInternal = asyncHandler(async (req, res) => {
  const schoolId = String(req.header('x-school-id') ?? '');
  const studentResponse = await axios.get(`${env.USER_SERVICE_URL}/internal/student-details`, {
    params: { ids: req.params.studentId },
  });
  const student = studentResponse.data.data[0];
  const exams = student?.classId ? await Exam.find({ schoolId, classIds: student.classId, status: 'upcoming' }) : [];
  return ApiResponse.success(res, 200, exams, 'Student exams fetched successfully');
});
