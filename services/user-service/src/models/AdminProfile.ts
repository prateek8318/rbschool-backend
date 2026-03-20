import mongoose, { Schema } from 'mongoose';

export interface IAdminProfile {
  schoolId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<IAdminProfile>(
  {
    schoolId: { type: String, required: true, index: true },
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
  },
  { timestamps: true },
);

export const AdminProfile = mongoose.model<IAdminProfile>('AdminProfile', adminSchema);
