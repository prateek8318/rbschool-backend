import mongoose, { Schema } from 'mongoose';

export interface IFeeInstallment {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'paid' | 'pending' | 'overdue';
  paymentMode?: 'cash' | 'online' | 'cheque';
  transactionId?: string;
  recordedBy?: string;
}

export interface IFeeRecord {
  schoolId: string;
  studentId: string;
  academicYear: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  installments: IFeeInstallment[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const installmentSchema = new Schema<IFeeInstallment>(
  {
    quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'], required: true },
    amount: { type: Number, required: true },
    dueDate: { type: String, required: true },
    paidDate: { type: String },
    status: { type: String, enum: ['paid', 'pending', 'overdue'], default: 'pending' },
    paymentMode: { type: String, enum: ['cash', 'online', 'cheque'] },
    transactionId: { type: String },
    recordedBy: { type: String },
  },
  { _id: false },
);

const feeSchema = new Schema<IFeeRecord>(
  {
    schoolId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    academicYear: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    pendingAmount: { type: Number, required: true },
    installments: { type: [installmentSchema], default: [] },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

feeSchema.index({ schoolId: 1, studentId: 1, academicYear: 1 }, { unique: true });

export const FeeRecord = mongoose.model<IFeeRecord>('FeeRecord', feeSchema);
