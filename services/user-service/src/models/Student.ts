import mongoose, { Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

export interface IStudent {
  schoolId: string;
  name: string;
  dob: Date;
  gender: 'male' | 'female' | 'other';
  photoUrl?: string;
  classId?: string | null;
  section?: string;
  rollNumber: string;
  admissionNumber: string;
  parentUserId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>(
  {
    schoolId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    photoUrl: { type: String },
    classId: { type: String, default: null },
    section: { type: String },
    rollNumber: { type: String, required: true },
    admissionNumber: { type: String, required: true },
    parentUserId: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

studentSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });
studentSchema.plugin(mongoosePaginate);

export const Student = mongoose.model<IStudent>('Student', studentSchema);
