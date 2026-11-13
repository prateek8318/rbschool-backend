import { Types } from 'mongoose';
import { notFound } from '../../core/errors';
import { Institution } from './institution.model';

type CachedInstitution = {
  id: string;
  name: string;
  code: string;
  type: string;
  timezone: string;
  currency: string;
  isActive: boolean;
  settings: {
    attendanceMode: 'daily' | 'per_period';
    workingDays: number[];
    gradingScale: Array<{ min: number; grade: string; gradePoint?: number }>;
    passPercentage: number;
    lowAttendanceThreshold: number;
    notifyGuardiansOnAbsence: boolean;
    sendFeeReminders: boolean;
  };
};

const cache = new Map<string, { value: CachedInstitution; expiresAt: number }>();
const TTL_MS = 60_000;

/** Frequently needed institution settings, cached for a minute. */
export const getInstitutionSettings = async (institutionId: string | Types.ObjectId): Promise<CachedInstitution> => {
  const key = String(institutionId);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const doc = await Institution.findById(key).lean();
  if (!doc) throw notFound('Institution');

  const value: CachedInstitution = {
    id: key,
    name: doc.name,
    code: doc.code,
    type: doc.type,
    timezone: doc.timezone ?? 'Asia/Kolkata',
    currency: doc.currency ?? 'INR',
    isActive: doc.isActive ?? true,
    settings: {
      attendanceMode: (doc.settings?.attendanceMode ?? 'daily') as 'daily' | 'per_period',
      workingDays: doc.settings?.workingDays ?? [1, 2, 3, 4, 5, 6],
      gradingScale: (doc.settings?.gradingScale ?? []).map((band) => ({
        min: band.min ?? 0,
        grade: band.grade ?? '',
        gradePoint: band.gradePoint ?? undefined,
      })),
      passPercentage: doc.settings?.passPercentage ?? 33,
      lowAttendanceThreshold: doc.settings?.lowAttendanceThreshold ?? 75,
      notifyGuardiansOnAbsence: doc.settings?.notifyGuardiansOnAbsence ?? true,
      sendFeeReminders: doc.settings?.sendFeeReminders ?? true,
    },
  };
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
};

export const invalidateInstitutionCache = (institutionId: string) => cache.delete(String(institutionId));
