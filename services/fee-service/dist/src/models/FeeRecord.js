"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeRecord = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const installmentSchema = new mongoose_1.Schema({
    quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'], required: true },
    amount: { type: Number, required: true },
    dueDate: { type: String, required: true },
    paidDate: { type: String },
    status: { type: String, enum: ['paid', 'pending', 'overdue'], default: 'pending' },
    paymentMode: { type: String, enum: ['cash', 'online', 'cheque'] },
    transactionId: { type: String },
    recordedBy: { type: String },
}, { _id: false });
const feeSchema = new mongoose_1.Schema({
    schoolId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    academicYear: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    pendingAmount: { type: Number, required: true },
    installments: { type: [installmentSchema], default: [] },
    isArchived: { type: Boolean, default: false },
}, { timestamps: true });
feeSchema.index({ schoolId: 1, studentId: 1, academicYear: 1 }, { unique: true });
exports.FeeRecord = mongoose_1.default.model('FeeRecord', feeSchema);
