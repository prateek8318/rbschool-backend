import { InferSchemaType, Schema, Types, model } from 'mongoose';

export const EXAM_TYPES = ['unit_test', 'midterm', 'final', 'quiz', 'assignment', 'practical', 'mock_test', 'other'] as const;

/** An exam held for one or more batches, with one paper per subject. */
const examSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: EXAM_TYPES, default: 'other' },
    batchIds: [{ type: Schema.Types.ObjectId, ref: 'Batch', required: true }],
    papers: [
      {
        subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
        date: { type: String, required: true },
        startTime: { type: String },
        durationMinutes: { type: Number },
        maxMarks: { type: Number, required: true },
        /** Defaults to the institution's pass percentage of maxMarks. */
        passMarks: { type: Number },
      },
    ],
    status: { type: String, enum: ['scheduled', 'published'], default: 'scheduled' },
    resultsPublishedAt: { type: Date },
    instructions: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

examSchema.index({ institutionId: 1, sessionId: 1, batchIds: 1 });

export type ExamAttrs = InferSchemaType<typeof examSchema> & { _id: Types.ObjectId };
export const Exam = model('Exam', examSchema);

/** One student's marks in one exam (all subjects). */
const examResultSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    scores: [
      {
        _id: false,
        subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
        marks: { type: Number, default: null },
        isAbsent: { type: Boolean, default: false },
        grade: { type: String },
        remark: { type: String },
        enteredBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    totalMarks: { type: Number, default: 0 },
    maxMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    grade: { type: String },
    gradePoint: { type: Number },
    result: { type: String, enum: ['pass', 'fail', 'incomplete'], default: 'incomplete' },
    /** Rank inside the batch, set when results are published. */
    rank: { type: Number },
    remarks: { type: String },
  },
  { timestamps: true },
);

examResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });
examResultSchema.index({ institutionId: 1, studentId: 1 });
examResultSchema.index({ examId: 1, batchId: 1 });

export const ExamResult = model('ExamResult', examResultSchema);
