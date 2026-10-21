import mongoose, { Document, Schema } from "mongoose";

/**
 * One full backup of the database: every collection exported as gzipped Extended-JSON lines
 * (ObjectIds and dates kept exactly), stored as PRIVATE files on Cloudinary. Files are only
 * downloadable through short-lived signed links requested by a Super Admin.
 */
export interface IDataBackupFile {
  collectionName: string;
  part: number;
  documents: number;
  bytes: number;
  publicId: string;
}

export interface IDataBackup extends Document {
  status: "running" | "done" | "failed";
  trigger: "manual" | "scheduled";
  startedBy?: mongoose.Types.ObjectId;
  startedAt: Date;
  finishedAt?: Date;
  files: IDataBackupFile[];
  totalDocuments: number;
  totalBytes: number;
  collectionsCount: number;
  error?: string;
}

const DataBackupSchema = new Schema<IDataBackup>(
  {
    status: { type: String, enum: ["running", "done", "failed"], default: "running" },
    trigger: { type: String, enum: ["manual", "scheduled"], required: true },
    startedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    files: [
      {
        _id: false,
        collectionName: { type: String, required: true },
        part: { type: Number, default: 1 },
        documents: { type: Number, default: 0 },
        bytes: { type: Number, default: 0 },
        publicId: { type: String, required: true },
      },
    ],
    totalDocuments: { type: Number, default: 0 },
    totalBytes: { type: Number, default: 0 },
    collectionsCount: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true }
);

DataBackupSchema.index({ startedAt: -1 });

export default mongoose.model<IDataBackup>("DataBackup", DataBackupSchema);
