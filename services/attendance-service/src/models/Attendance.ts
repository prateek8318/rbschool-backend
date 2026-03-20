import mongoose, { Schema } from 'mongoose';
import { AttendanceStatus } from '@rbschool/shared';

export interface IAttendance {
  schoolId: string;
  classId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  markedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    schoolId: { type: String, required: true, index: true },
    classId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    status: { type: String, enum: ['present', 'absent', 'holiday', 'half_day'], required: true },
    markedBy: { type: String, required: true },
  },
  { timestamps: true },
);

attendanceSchema.index({ schoolId: 1, classId: 1, date: 1 });
attendanceSchema.index({ schoolId: 1, studentId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema);
