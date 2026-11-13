import { HydratedDocument, InferSchemaType, Schema, model } from 'mongoose';

const lineItem = { _id: false, name: { type: String, required: true }, amount: { type: Number, required: true, min: 0 } };

/**
 * A reusable fee plan, e.g. "Class 10 Annual Fee 2026-27" or
 * "JEE Crash Course" with its components and installment schedule.
 */
const feeStructureSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    name: { type: String, required: true, trim: true },
    programIds: [{ type: Schema.Types.ObjectId, ref: 'Program' }],
    components: [lineItem],
    installments: [
      {
        _id: false,
        label: { type: String, required: true },
        dueDate: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
feeStructureSchema.index({ institutionId: 1, sessionId: 1, name: 1 }, { unique: true });

export const FeeStructure = model('FeeStructure', feeStructureSchema);

export const INVOICE_STATUSES = ['unpaid', 'partial', 'paid', 'overdue', 'cancelled'] as const;

/** What one student owes (usually generated from a fee structure). */
const invoiceSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    structureId: { type: Schema.Types.ObjectId, ref: 'FeeStructure' },
    title: { type: String, required: true },
    items: [lineItem],
    discount: {
      amount: { type: Number, default: 0, min: 0 },
      reason: { type: String },
    },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    installments: [
      {
        _id: false,
        label: { type: String, required: true },
        dueDate: { type: String, required: true },
        amount: { type: Number, required: true },
        paidAmount: { type: Number, default: 0 },
        status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue'], default: 'pending' },
      },
    ],
    status: { type: String, enum: INVOICE_STATUSES, default: 'unpaid' },
    /** Earliest unpaid due date — handy for sorting and reminders. */
    nextDueDate: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
invoiceSchema.index({ institutionId: 1, studentId: 1, sessionId: 1 });
invoiceSchema.index({ institutionId: 1, status: 1, nextDueDate: 1 });
invoiceSchema.index(
  { structureId: 1, studentId: 1 },
  // One live invoice per student per fee structure (cancelled ones don't count).
  { unique: true, partialFilterExpression: { structureId: { $type: 'objectId' }, status: { $in: ['unpaid', 'partial', 'paid', 'overdue'] } } },
);

export type InvoiceDoc = HydratedDocument<InferSchemaType<typeof invoiceSchema>>;
export const Invoice = model('Invoice', invoiceSchema);

export const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'online'] as const;

const paymentSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    mode: { type: String, enum: PAYMENT_MODES, required: true },
    reference: { type: String },
    paidAt: { type: String, required: true },
    receiptNo: { type: String, required: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String },
    status: { type: String, enum: ['success', 'reversed'], default: 'success' },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reversalReason: { type: String },
  },
  { timestamps: true },
);
paymentSchema.index({ institutionId: 1, receiptNo: 1 }, { unique: true });
paymentSchema.index({ institutionId: 1, paidAt: -1 });
paymentSchema.index({ invoiceId: 1 });

export const Payment = model('Payment', paymentSchema);
