import { Schema, model, models, type Model } from "mongoose";

// Sequence numbers (memberNo, receiptNumber, caseNo). Incremented atomically.
type CounterDoc = { _id: string; seq: number };

const counterSchema = new Schema<CounterDoc>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: "counters", versionKey: false },
);

export const Counter: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc> | undefined) ?? model<CounterDoc>("Counter", counterSchema);
