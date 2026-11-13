import { ClientSession, Schema, model } from 'mongoose';

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = model('Counter', counterSchema);

/** Atomic sequence, e.g. nextSequence(`receipt:${institutionId}:2026`) -> 1, 2, 3... */
export const nextSequence = async (key: string, session?: ClientSession) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  );
  return counter.seq;
};
