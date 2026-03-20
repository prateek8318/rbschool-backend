import mongoose, { Schema } from 'mongoose';

export interface IParentProfile {
  schoolId: string;
  userId: string;
  name: string;
  phone: string;
  childStudentIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const parentSchema = new Schema<IParentProfile>(
  {
    schoolId: { type: String, required: true, index: true },
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    childStudentIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

parentSchema.index({ schoolId: 1, phone: 1 }, { unique: true });

export const ParentProfile = mongoose.model<IParentProfile>('ParentProfile', parentSchema);
