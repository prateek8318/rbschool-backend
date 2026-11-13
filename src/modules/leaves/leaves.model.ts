import { Schema, model } from 'mongoose';
import { ROLES } from '../../core/roles';

const leaveSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    applicantUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    applicantRole: { type: String, enum: ROLES, required: true },
    /** Set for student leave (applied by the student or a guardian). */
    studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
    type: { type: String, enum: ['casual', 'sick', 'emergency', 'family', 'other'], default: 'casual' },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String },
  },
  { timestamps: true },
);
leaveSchema.index({ institutionId: 1, status: 1, createdAt: -1 });
leaveSchema.index({ institutionId: 1, applicantUserId: 1 });
leaveSchema.index({ institutionId: 1, batchId: 1, status: 1 });

export const LeaveRequest = model('LeaveRequest', leaveSchema);
