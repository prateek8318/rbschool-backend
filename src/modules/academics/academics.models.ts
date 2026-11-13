import { InferSchemaType, Schema, Types, model } from 'mongoose';

/**
 * Program = what is being studied, over time.
 *   School: "Class 10"   College: "B.Tech CSE"   Coaching: "JEE Advanced 2027"
 */
const programSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    description: { type: String },
    /** Sort order, e.g. 1..12 for school classes, 1..8 for semesters. */
    level: { type: Number, default: 0 },
    /** Free text, e.g. "4 years", "6 months". */
    duration: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
programSchema.index({ institutionId: 1, name: 1 }, { unique: true });

export const Program = model('Program', programSchema);

const subjectSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    type: { type: String, enum: ['theory', 'practical', 'activity', 'other'], default: 'theory' },
    credits: { type: Number },
    /** Programs this subject is usually part of (optional, for suggestions). */
    programIds: [{ type: Schema.Types.ObjectId, ref: 'Program' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
subjectSchema.index({ institutionId: 1, name: 1, code: 1 }, { unique: true });

export const Subject = model('Subject', subjectSchema);

/**
 * Batch = one group of students studying a program together in a session.
 *   School: "10-A"   College: "Sem 3 - Div B"   Coaching: "Morning Batch"
 * Holds who teaches which subject to this group.
 */
const batchSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
    name: { type: String, required: true, trim: true },
    /** Class teacher / mentor / batch coordinator (User id). */
    coordinatorId: { type: Schema.Types.ObjectId, ref: 'User' },
    room: { type: String },
    capacity: { type: Number },
    subjects: [
      {
        _id: false,
        subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
        teacherId: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
batchSchema.index({ institutionId: 1, sessionId: 1, programId: 1, name: 1 }, { unique: true });
batchSchema.index({ institutionId: 1, coordinatorId: 1 });
batchSchema.index({ institutionId: 1, 'subjects.teacherId': 1 });

export type BatchAttrs = InferSchemaType<typeof batchSchema> & { _id: Types.ObjectId };
export const Batch = model('Batch', batchSchema);

/** One recurring weekly period. */
const timetableSlotSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    /** 0 = Sunday ... 6 = Saturday */
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject' },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User' },
    room: { type: String },
    /** For breaks / assembly etc. */
    label: { type: String },
  },
  { timestamps: true },
);
timetableSlotSchema.index({ institutionId: 1, batchId: 1, dayOfWeek: 1, startTime: 1 });
timetableSlotSchema.index({ institutionId: 1, teacherId: 1, dayOfWeek: 1 });

export const TimetableSlot = model('TimetableSlot', timetableSlotSchema);
