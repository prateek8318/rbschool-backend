import mongoose, { Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

export interface ITeacherProfile {
  schoolId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  subjects: string[];
  assignedClassIds: string[];
  experienceYears: number;
  qualification?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teacherSchema = new Schema<ITeacherProfile>(
  {
    schoolId: { type: String, required: true, index: true },
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    subjects: { type: [String], default: [] },
    assignedClassIds: { type: [String], default: [] },
    experienceYears: { type: Number, default: 0 },
    qualification: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

teacherSchema.plugin(mongoosePaginate);

export const TeacherProfile = mongoose.model<ITeacherProfile>('TeacherProfile', teacherSchema);
