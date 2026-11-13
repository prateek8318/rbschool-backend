import { Schema, model } from 'mongoose';
import { ROLES } from '../../core/roles';

/**
 * Notice board post. Audience filters are ANDed:
 * roles (empty = everyone) + batches/programs (empty = all).
 */
const announcementSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    audience: {
      roles: [{ type: String, enum: ROLES }],
      batchIds: [{ type: Schema.Types.ObjectId, ref: 'Batch' }],
      programIds: [{ type: Schema.Types.ObjectId, ref: 'Program' }],
    },
    attachments: [{ _id: false, name: String, url: String }],
    isPinned: { type: Boolean, default: false },
    expiresAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
announcementSchema.index({ institutionId: 1, createdAt: -1 });

export const Announcement = model('Announcement', announcementSchema);

export const NOTIFICATION_CATEGORIES = ['attendance', 'exam', 'fee', 'leave', 'announcement', 'general'] as const;

/** Personal inbox item for one user in one institution. */
const notificationSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, default: 'general' },
    /** Where the app should navigate on tap, e.g. { type: 'exam', id }. */
    data: { type: Schema.Types.Mixed },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);
notificationSchema.index({ userId: 1, institutionId: 1, createdAt: -1 });
// Inbox items are kept for 180 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 86_400 });

export const Notification = model('Notification', notificationSchema);

/** Push tokens registered by the mobile apps (FCM / APNs / Expo). */
const deviceTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
  },
  { timestamps: true },
);

export const DeviceToken = model('DeviceToken', deviceTokenSchema);
