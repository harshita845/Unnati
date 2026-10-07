import mongoose, { Schema, Document } from "mongoose";

/**
 * A POS counter with a customer-facing screen. The screen authenticates with `displayKey`
 * (no admin login on the customer monitor). `state` is the last bill snapshot the cashier
 * pushed, so a screen that (re)connects or polls can catch up.
 */
export interface ICustomerDisplayTerminal extends Document {
  code: string;
  name: string;
  displayKey: string;
  isActive: boolean;
  state: Record<string, any> | null;
  stateSeq: number;
  stateUpdatedAt?: Date | null;
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerDisplayTerminalSchema = new Schema<ICustomerDisplayTerminal>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      match: [/^[A-Za-z0-9_-]{1,20}$/, "Terminal code can use letters, numbers, - and _ (max 20)"],
    },
    name: { type: String, trim: true, maxlength: 60, default: "" },
    displayKey: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true },
    state: { type: Schema.Types.Mixed, default: null },
    stateSeq: { type: Number, default: 0 },
    stateUpdatedAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false }
);

export default mongoose.model<ICustomerDisplayTerminal>("CustomerDisplayTerminal", CustomerDisplayTerminalSchema);
