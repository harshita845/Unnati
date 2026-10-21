import mongoose from "mongoose";
import { gzipSync } from "zlib";
import { v2 as cloudinary } from "cloudinary";
import DataBackup, { IDataBackupFile } from "../models/DataBackup";

/**
 * Database backup: every collection is exported as gzipped Extended-JSON lines (one document per
 * line; ObjectIds, dates and numbers keep their exact types) and uploaded to Cloudinary as a
 * PRIVATE raw file. A backup is restorable with `mongoimport` (see docs below), per collection.
 *
 * Runs on demand (Super Admin → Data Backup) and daily (Vercel Cron → /api/v1/cron/backup).
 * The newest KEEP_BACKUPS completed backups are kept; older ones are deleted with their files.
 */

const BACKUP_FOLDER = "Unnati Stores/backups";
/** Cloudinary's raw-file limit on the free plan is 10 MB: stay below it per part */
const MAX_PART_BYTES = 9 * 1024 * 1024;
export const KEEP_BACKUPS = 7;
/** A backup still "running" after this long crashed (function timeout): it no longer blocks a new one */
const STALE_RUN_MS = 20 * 60 * 1000;

export class BackupError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const uploadPrivateRaw = (buffer: Buffer, publicId: string): Promise<{ publicId: string; bytes: number }> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      // "private": the file is never served from a public URL; only signed download links work
      { resource_type: "raw", type: "private", public_id: publicId, overwrite: true, timeout: 120000 },
      (error: any, result: any) => {
        if (error || !result) return reject(new Error(error?.message || "Upload returned no result"));
        resolve({ publicId: result.public_id, bytes: result.bytes });
      }
    );
    stream.end(buffer);
  });

const deletePrivateRaw = async (publicIds: string[]) => {
  if (!publicIds.length) return;
  await cloudinary.api.delete_resources(publicIds, { resource_type: "raw", type: "private" }).catch((error: any) => {
    console.error("Deleting old backup files failed:", error?.message || error);
  });
};

/** Export one collection as gzipped EJSON lines, split into parts under the upload limit. */
async function backupCollection(name: string, stamp: string, files: IDataBackupFile[]): Promise<void> {
  const db = mongoose.connection.db!;
  const EJSON = mongoose.mongo.BSON.EJSON;
  const startCount = files.length;
  let lines: string[] = [];
  let rawBytes = 0;
  let docs = 0;
  let part = 1;

  const flush = async () => {
    // An empty collection still gets one (empty) file, so the backup lists every collection
    if (!docs && files.length > startCount) return;
    const gz = gzipSync(Buffer.from(lines.join("\n") + (lines.length ? "\n" : ""), "utf8"));
    const publicId = `${BACKUP_FOLDER}/${stamp}/${name}.part${part}.jsonl.gz`;
    const uploaded = await uploadPrivateRaw(gz, publicId);
    files.push({ collectionName: name, part, documents: docs, bytes: uploaded.bytes, publicId: uploaded.publicId });
    part++;
    lines = [];
    rawBytes = 0;
    docs = 0;
  };

  for await (const doc of db.collection(name).find({}, { batchSize: 500 })) {
    const line = EJSON.stringify(doc, { relaxed: false });
    lines.push(line);
    rawBytes += line.length;
    docs++;
    // Text compresses well; split on the raw size with a safe margin so each gzip part stays small
    if (rawBytes >= MAX_PART_BYTES * 4) await flush();
  }
  await flush();
}

/** Run a full backup. One at a time; returns the finished record. */
export async function runBackup(trigger: "manual" | "scheduled", adminId?: unknown) {
  const running = await DataBackup.findOne({ status: "running", startedAt: { $gt: new Date(Date.now() - STALE_RUN_MS) } }).lean();
  if (running) throw new BackupError(409, "A backup is already running. Wait for it to finish.");
  await DataBackup.updateMany({ status: "running" }, { $set: { status: "failed", error: "Stopped before finishing (timed out)", finishedAt: new Date() } });

  const record = await DataBackup.create({
    trigger,
    startedBy: adminId && mongoose.isValidObjectId(String(adminId)) ? adminId : undefined,
    startedAt: new Date(),
  });
  const stamp = record.startedAt.toISOString().replace(/[:.]/g, "-");
  // Every file uploaded so far, so a failed run can remove them
  const files: IDataBackupFile[] = [];

  try {
    const collections = (await mongoose.connection.db!.listCollections({}, { nameOnly: true }).toArray())
      .map((c: any) => c.name as string)
      .filter((n) => !n.startsWith("system."))
      .sort();
    for (const name of collections) await backupCollection(name, stamp, files);

    record.files = files;
    record.collectionsCount = collections.length;
    record.totalDocuments = files.reduce((s, f) => s + f.documents, 0);
    record.totalBytes = files.reduce((s, f) => s + f.bytes, 0);
    record.status = "done";
    record.finishedAt = new Date();
    await record.save();
  } catch (error: any) {
    console.error("Backup failed:", error);
    record.status = "failed";
    record.error = String(error?.message || error).slice(0, 500);
    record.finishedAt = new Date();
    await record.save();
    // Remove whatever was uploaded for the failed run
    await deletePrivateRaw(files.map((f) => f.publicId));
    throw new BackupError(500, `Backup failed: ${record.error}`);
  }

  await pruneOldBackups();
  return record;
}

/** Keep the newest KEEP_BACKUPS completed backups; delete older ones (files first). */
export async function pruneOldBackups() {
  const old = await DataBackup.find({ status: "done" }).sort({ startedAt: -1 }).skip(KEEP_BACKUPS).lean();
  for (const b of old) {
    await deletePrivateRaw(b.files.map((f) => f.publicId));
    await DataBackup.deleteOne({ _id: b._id });
  }
  // Failed runs older than a week are only clutter
  await DataBackup.deleteMany({ status: "failed", startedAt: { $lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } });
}

export const listBackups = () => DataBackup.find().sort({ startedAt: -1 }).limit(30).populate("startedBy", "firstName lastName email").lean();

/** A short-lived signed link to download one file of a backup (Super Admin only). */
export async function backupFileDownloadUrl(backupId: string, index: number) {
  if (!mongoose.isValidObjectId(backupId)) throw new BackupError(404, "Backup not found");
  const backup: any = await DataBackup.findById(backupId).lean();
  if (!backup || backup.status !== "done") throw new BackupError(404, "Backup not found");
  const file = backup.files[index];
  if (!file) throw new BackupError(404, "File not found");
  const url = cloudinary.utils.private_download_url(file.publicId, "", {
    resource_type: "raw",
    type: "private",
    expires_at: Math.floor(Date.now() / 1000) + 10 * 60,
    attachment: true,
  });
  return { url, fileName: file.publicId.split("/").pop(), expiresInSeconds: 600 };
}
