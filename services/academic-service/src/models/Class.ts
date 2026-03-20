import mongoose, { Schema } from 'mongoose';

export interface IClass {
  schoolId: string;
  name: string;
  section: string;
  teacherId?: string;
  academicYear: string;
  subjects: string[];
  studentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const classSchema = new Schema<IClass>(
  {
    schoolId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    section: { type: String, required: true },
    teacherId: { type: String },
    academicYear: { type: String, required: true },
    subjects: { type: [String], default: [] },
    studentCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

classSchema.index({ schoolId: 1, name: 1, section: 1, academicYear: 1 }, { unique: true });

export const ClassModel = mongoose.model<IClass>('Class', classSchema);
