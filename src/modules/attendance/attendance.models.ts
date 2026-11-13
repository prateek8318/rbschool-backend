import { Schema, model } from 'mongoose';

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'leave', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Statuses that count as "attended" for percentages. */
export const ATTENDED: AttendanceStatus[] = ['present', 'late'];
/** Statuses that don't count against the student at all. */
export const NOT_COUNTED: AttendanceStatus[] = ['excused'];

/**
 * One register: a batch on a date (and for colleges, a specific period).
 * Embedding the entries keeps "mark the whole class" a single write.
 */
const attendanceSheetSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    date: { type: String, required: true },
    /** "day" for daily attendance, or the period start time e.g. "09:00". */
    period: { type: String, default: 'day' },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject' },
    takenBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entries: [
      {
        _id: false,
        studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
        status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
        remark: { type: String },
      },
    ],
    counts: {
      present: { type: Number, default: 0 },
      absent: { type: Number, default: 0 },
      late: { type: Number, default: 0 },
      leave: { type: Number, default: 0 },
      excused: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

attendanceSheetSchema.index({ batchId: 1, date: 1, period: 1 }, { unique: true });
attendanceSheetSchema.index({ institutionId: 1, date: 1 });
attendanceSheetSchema.index({ institutionId: 1, 'entries.studentId': 1, date: 1 });

export const AttendanceSheet = model('AttendanceSheet', attendanceSheetSchema);

const holidaySchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    date: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['national', 'regional', 'institution', 'exam', 'vacation'], default: 'institution' },
    /** Empty = whole institution, otherwise only these batches. */
    batchIds: [{ type: Schema.Types.ObjectId, ref: 'Batch' }],
  },
  { timestamps: true },
);

holidaySchema.index({ institutionId: 1, date: 1, name: 1 }, { unique: true });

export const Holiday = model('Holiday', holidaySchema);
