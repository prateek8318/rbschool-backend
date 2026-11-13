import { Model, Types } from 'mongoose';
import { Membership } from '../modules/auth/membership.model';
import { badRequest } from './errors';
import { Role } from './roles';

type AnyId = string | Types.ObjectId;

/**
 * Ensures every referenced document exists inside the same institution.
 * Stops one institution from linking (or reading) another one's data by id.
 */
export const assertOwned = async (
  model: Model<any>,
  institutionId: AnyId,
  ids: Array<AnyId | null | undefined>,
  label: string,
) => {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return;
  const count = await model.countDocuments({ _id: { $in: unique }, institutionId });
  if (count !== unique.length) throw badRequest(`One or more ${label} do not exist in this institution`);
};

/** Ensures every user id is an active member with one of the given roles. */
export const assertMembers = async (
  institutionId: AnyId,
  userIds: Array<AnyId | null | undefined>,
  roles: Role[],
  label: string,
) => {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];
  if (!unique.length) return;
  const found = await Membership.distinct('userId', {
    institutionId,
    userId: { $in: unique },
    role: { $in: roles },
    status: 'active',
  });
  if (found.length !== unique.length) throw badRequest(`One or more ${label} are not active members of this institution`);
};
