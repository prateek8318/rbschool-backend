import mongoose, { Schema } from 'mongoose';

export interface IHolidayCalendar {
  schoolId: string;
  date: string;
  name: string;
  type: 'national' | 'state' | 'school';
  createdAt: Date;
  updatedAt: Date;
}

const holidaySchema = new Schema<IHolidayCalendar>(
  {
    schoolId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['national', 'state', 'school'], required: true },
  },
  { timestamps: true },
);

holidaySchema.index({ schoolId: 1, date: 1 }, { unique: true });

export const HolidayCalendar = mongoose.model<IHolidayCalendar>('HolidayCalendar', holidaySchema);
