import mongoose, { Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

export interface INotification {
  schoolId: string;
  userId: string;
  title: string;
  message: string;
  type: 'push' | 'sms' | 'in_app';
  isRead: boolean;
  relatedEntity?: { type: string; id: string };
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    schoolId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['push', 'sms', 'in_app'], default: 'in_app' },
    isRead: { type: Boolean, default: false },
    relatedEntity: { type: { type: String }, id: { type: String } },
  },
  { timestamps: true },
);

notificationSchema.plugin(mongoosePaginate);

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
