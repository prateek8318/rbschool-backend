import mongoose, { Schema } from 'mongoose';
import { ExamStatus, ExamType } from '@rbschool/shared';

export interface IExam {
  schoolId: string;
  classIds: string[];
  name: string;
  type: ExamType;
  subjects: string[];
  startDate: Date;
  endDate: Date;
  maxMarks: number;
  status: ExamStatus;
  createdAt: Date;
  updatedAt: Date;
}

const examSchema = new Schema<IExam>(
  {
    schoolId: { type: String, required: true, index: true },
    classIds: { type: [String], default: [] },
    name: { type: String, required: true },
    type: { type: String, enum: ['unit', 'midterm', 'final'], required: true },
    subjects: { type: [String], default: [] },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    maxMarks: { type: Number, default: 100 },
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed'], default: 'upcoming' },
  },
  { timestamps: true },
);

export const Exam = mongoose.model<IExam>('Exam', examSchema);
