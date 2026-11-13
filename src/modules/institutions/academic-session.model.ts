import { Schema, Types, model } from 'mongoose';
import { notFound } from '../../core/errors';

/** Academic year / session / semester window, e.g. "2026-27". */
const academicSessionSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

academicSessionSchema.index({ institutionId: 1, name: 1 }, { unique: true });
academicSessionSchema.index({ institutionId: 1, isCurrent: 1 });

export const AcademicSession = model('AcademicSession', academicSessionSchema);

export const getCurrentSession = async (institutionId: string | Types.ObjectId) => {
  const session = await AcademicSession.findOne({ institutionId, isCurrent: true }).lean();
  if (!session) throw notFound('Current academic session');
  return session;
};

/** Default session name for "today", e.g. "2026-27" when the year starts in April. */
export const defaultSessionWindow = (startMonth = 4) => {
  const now = new Date();
  const year = now.getMonth() + 1 >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
  const pad = (value: number) => String(value).padStart(2, '0');
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endYear = startMonth === 1 ? year : year + 1;
  const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  return {
    name: startMonth === 1 ? String(year) : `${year}-${String(year + 1).slice(-2)}`,
    startDate: `${year}-${pad(startMonth)}-01`,
    endDate: `${endYear}-${pad(endMonth)}-${pad(lastDay)}`,
  };
};
