import { Types } from 'mongoose';
import { TenantContext } from '../../core/auth';
import { forbidden, notFound } from '../../core/errors';
import { isManagement } from '../../core/roles';
import { Batch, BatchAttrs } from './academics.models';

/** True if the user is the batch coordinator or teaches any subject in it. */
export const teachesBatch = (batch: Pick<BatchAttrs, 'coordinatorId' | 'subjects'>, userId: string) =>
  String(batch.coordinatorId ?? '') === userId ||
  (batch.subjects ?? []).some((subject) => String(subject.teacherId ?? '') === userId);

export const loadBatch = async (institutionId: string, batchId: string) => {
  const batch = await Batch.findOne({ _id: batchId, institutionId }).lean<BatchAttrs>();
  if (!batch) throw notFound('Batch');
  return batch;
};

/** Management can act on any batch; teachers only on batches they teach. */
export const assertCanManageBatch = async (ctx: TenantContext, batchId: string) => {
  const batch = await loadBatch(ctx.institutionId, batchId);
  if (!isManagement(ctx.role) && !(ctx.role === 'teacher' && teachesBatch(batch, ctx.userId))) {
    throw forbidden('You are not assigned to this batch');
  }
  return batch;
};

/** Batches a teacher is linked to (as coordinator or subject teacher). */
export const teacherBatchIds = async (institutionId: string, userId: string): Promise<Types.ObjectId[]> => {
  const batches = await Batch.find({
    institutionId,
    isActive: true,
    $or: [{ coordinatorId: userId }, { 'subjects.teacherId': userId }],
  })
    .select('_id')
    .lean();
  return batches.map((batch) => batch._id);
};
