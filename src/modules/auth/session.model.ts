import { Schema, model } from 'mongoose';

/** One logged-in device. Refresh tokens rotate on every use. */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: 'Membership' },
    /** Set when a platform admin is working inside an institution (no membership). */
    platformInstitutionId: { type: Schema.Types.ObjectId, ref: 'Institution' },
    refreshTokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String },
    ip: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// MongoDB removes expired sessions automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model('Session', sessionSchema);
