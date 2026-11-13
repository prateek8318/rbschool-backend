import mongoose, { Schema } from 'mongoose';

export interface ILeaveApplication {
  schoolId: string;
  userId: string;
  role: 'admin' | 'teacher' | 'parent';
  leaveType: string; // casual, medical, emergency
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leaveSchema = new Schema<ILeaveApplication>(
  {
    schoolId: { type: String, required: true },
    userId: { type: String, required: true },
    role: { type: String, enum: ['admin', 'teacher', 'parent'], required: true },
    leaveType: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: String },
  },
  { timestamps: true },
);

leaveSchema.index({ schoolId: 1, userId: 1 });

export const LeaveApplication = mongoose.model<ILeaveApplication>('LeaveApplication', leaveSchema);
