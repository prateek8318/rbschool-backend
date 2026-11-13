import { InferSchemaType, Schema, Types, model } from 'mongoose';

export const STUDENT_STATUSES = ['active', 'alumni', 'transferred', 'dropped'] as const;

/**
 * A learner in one institution. `userId` is set only if the student has their
 * own login (older students / college). Guardians are linked user accounts.
 */
const studentSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    enrollmentNo: { type: String, required: true, trim: true },
    rollNo: { type: String, trim: true },
    dob: { type: String },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    bloodGroup: { type: String },
    photoUrl: { type: String },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String },
    programId: { type: Schema.Types.ObjectId, ref: 'Program' },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
    guardians: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
        phone: { type: String },
        relation: { type: String, default: 'guardian' },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    admissionDate: { type: String },
    status: { type: String, enum: STUDENT_STATUSES, default: 'active' },
    /** Institution-specific extra fields (category, house, hostel room...). */
    customFields: { type: Map, of: String },
  },
  { timestamps: true },
);

studentSchema.index({ institutionId: 1, enrollmentNo: 1 }, { unique: true });
studentSchema.index({ institutionId: 1, batchId: 1, status: 1 });
studentSchema.index({ institutionId: 1, 'guardians.userId': 1 });
studentSchema.index({ institutionId: 1, userId: 1 });

export type StudentAttrs = InferSchemaType<typeof studentSchema> & { _id: Types.ObjectId };
export const Student = model('Student', studentSchema);

/** Employment details of a teacher / staff member / admin. */
const staffSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    employeeCode: { type: String, trim: true },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },
    subjectIds: [{ type: Schema.Types.ObjectId, ref: 'Subject' }],
    qualification: { type: String },
    experienceYears: { type: Number, default: 0 },
    joiningDate: { type: String },
    photoUrl: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
);

staffSchema.index({ institutionId: 1, userId: 1 }, { unique: true });
staffSchema.index(
  { institutionId: 1, employeeCode: 1 },
  { unique: true, partialFilterExpression: { employeeCode: { $type: 'string' } } },
);

export const Staff = model('Staff', staffSchema);
