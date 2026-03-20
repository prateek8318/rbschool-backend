import mongoose, { Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

export interface IAnnouncement {
  schoolId: string;
  title: string;
  message: string;
  targetRoles: Array<'admin' | 'teacher' | 'parent' | 'all'>;
  createdBy: string;
  deliveredCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    schoolId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    targetRoles: { type: [String], default: [] },
    createdBy: { type: String, required: true },
    deliveredCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

announcementSchema.plugin(mongoosePaginate);

export const Announcement = mongoose.model<IAnnouncement>('Announcement', announcementSchema);
