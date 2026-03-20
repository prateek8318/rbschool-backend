import mongoose, { Schema } from 'mongoose';

export interface ISchool {
  name: string;
  address: string;
  board: 'CBSE' | 'ICSE' | 'State';
  phone: string;
  email?: string;
  logoUrl?: string;
  academicYear?: string;
  settings: {
    pushNotifications: boolean;
    smsAlerts: boolean;
    autoFeeReminders: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schoolSchema = new Schema<ISchool>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    board: { type: String, enum: ['CBSE', 'ICSE', 'State'], required: true },
    phone: { type: String, required: true },
    email: { type: String },
    logoUrl: { type: String },
    academicYear: { type: String },
    settings: {
      pushNotifications: { type: Boolean, default: true },
      smsAlerts: { type: Boolean, default: false },
      autoFeeReminders: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const School = mongoose.model<ISchool>('School', schoolSchema);
