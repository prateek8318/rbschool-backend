import { InferSchemaType, Schema, model } from 'mongoose';

export const INSTITUTION_TYPES = ['school', 'college', 'university', 'coaching', 'training_center', 'other'] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

/**
 * The words the apps should show. A school says "Class 10 - Section A",
 * a college says "B.Tech CSE - Semester 3 Div A", a coaching institute says
 * "JEE 2027 - Morning Batch". The data model is the same: Program + Batch.
 */
export interface Terminology {
  program: string;
  batch: string;
  session: string;
  student: string;
  guardian: string;
  teacher: string;
  enrollmentNo: string;
}

export const DEFAULT_TERMINOLOGY: Record<InstitutionType, Terminology> = {
  school: {
    program: 'Class',
    batch: 'Section',
    session: 'Academic Year',
    student: 'Student',
    guardian: 'Parent',
    teacher: 'Teacher',
    enrollmentNo: 'Admission No.',
  },
  college: {
    program: 'Course',
    batch: 'Class',
    session: 'Academic Year',
    student: 'Student',
    guardian: 'Guardian',
    teacher: 'Faculty',
    enrollmentNo: 'Enrollment No.',
  },
  university: {
    program: 'Programme',
    batch: 'Class',
    session: 'Academic Year',
    student: 'Student',
    guardian: 'Guardian',
    teacher: 'Faculty',
    enrollmentNo: 'Enrollment No.',
  },
  coaching: {
    program: 'Course',
    batch: 'Batch',
    session: 'Session',
    student: 'Student',
    guardian: 'Parent',
    teacher: 'Faculty',
    enrollmentNo: 'Registration No.',
  },
  training_center: {
    program: 'Course',
    batch: 'Batch',
    session: 'Session',
    student: 'Trainee',
    guardian: 'Guardian',
    teacher: 'Trainer',
    enrollmentNo: 'Registration No.',
  },
  other: {
    program: 'Program',
    batch: 'Batch',
    session: 'Session',
    student: 'Student',
    guardian: 'Guardian',
    teacher: 'Teacher',
    enrollmentNo: 'Enrollment No.',
  },
};

export interface GradeBand {
  /** Minimum percentage (inclusive) for this grade. */
  min: number;
  grade: string;
  gradePoint?: number;
}

export const DEFAULT_GRADING_SCALE: GradeBand[] = [
  { min: 91, grade: 'A1', gradePoint: 10 },
  { min: 81, grade: 'A2', gradePoint: 9 },
  { min: 71, grade: 'B1', gradePoint: 8 },
  { min: 61, grade: 'B2', gradePoint: 7 },
  { min: 51, grade: 'C1', gradePoint: 6 },
  { min: 41, grade: 'C2', gradePoint: 5 },
  { min: 33, grade: 'D', gradePoint: 4 },
  { min: 0, grade: 'E', gradePoint: 0 },
];

/** Colleges usually take attendance per lecture, schools once a day. */
export const defaultAttendanceMode = (type: InstitutionType): 'daily' | 'per_period' =>
  type === 'college' || type === 'university' ? 'per_period' : 'daily';

const terminologySchema = new Schema<Terminology>(
  {
    program: String,
    batch: String,
    session: String,
    student: String,
    guardian: String,
    teacher: String,
    enrollmentNo: String,
  },
  { _id: false },
);

const institutionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Short unique code, e.g. "dps-noida". Used for usernames and receipts. */
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, enum: INSTITUTION_TYPES, required: true },
    /** Board / university / accrediting body, e.g. CBSE, AKTU, "Self". */
    affiliation: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    address: {
      line1: String,
      city: String,
      state: String,
      country: { type: String, default: 'India' },
      pincode: String,
    },
    logoUrl: { type: String },
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    settings: {
      terminology: { type: terminologySchema, required: true },
      attendanceMode: { type: String, enum: ['daily', 'per_period'], default: 'daily' },
      /** 0 = Sunday ... 6 = Saturday */
      workingDays: { type: [Number], default: [1, 2, 3, 4, 5, 6] },
      gradingScale: {
        type: [{ _id: false, min: Number, grade: String, gradePoint: Number }],
        default: () => DEFAULT_GRADING_SCALE,
      },
      passPercentage: { type: Number, default: 33 },
      lowAttendanceThreshold: { type: Number, default: 75 },
      notifyGuardiansOnAbsence: { type: Boolean, default: true },
      sendFeeReminders: { type: Boolean, default: true },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type InstitutionAttrs = InferSchemaType<typeof institutionSchema>;
export const Institution = model('Institution', institutionSchema);
