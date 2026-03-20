import mongoose, { Schema } from 'mongoose';

export interface IMarks {
  schoolId: string;
  examId: string;
  studentId: string;
  classId: string;
  subject: string;
  marksObtained: number;
  maxMarks: number;
  grade: string;
  rank?: number;
  enteredBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const marksSchema = new Schema<IMarks>(
  {
    schoolId: { type: String, required: true, index: true },
    examId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    classId: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    marksObtained: { type: Number, required: true },
    maxMarks: { type: Number, required: true },
    grade: { type: String, required: true },
    rank: { type: Number },
    enteredBy: { type: String, required: true },
  },
  { timestamps: true },
);

marksSchema.index({ examId: 1, studentId: 1, subject: 1 }, { unique: true });

export const Marks = mongoose.model<IMarks>('Marks', marksSchema);
