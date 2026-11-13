import { InferSchemaType, Schema, Types, model } from 'mongoose';
import { ROLES, Role } from '../../core/roles';

/** What a user is inside one institution. */
const membershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  },
  { timestamps: true },
);

membershipSchema.index({ userId: 1, institutionId: 1, role: 1 }, { unique: true });
membershipSchema.index({ institutionId: 1, role: 1, status: 1 });

export type MembershipAttrs = Omit<InferSchemaType<typeof membershipSchema>, 'role'> & { role: Role };
export const Membership = model<MembershipAttrs>('Membership', membershipSchema);

/** Creates the membership if missing, re-activates it if suspended. */
export const ensureMembership = async (
  userId: Types.ObjectId | string,
  institutionId: Types.ObjectId | string,
  role: Role,
) =>
  Membership.findOneAndUpdate(
    { userId, institutionId, role },
    { $set: { status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
