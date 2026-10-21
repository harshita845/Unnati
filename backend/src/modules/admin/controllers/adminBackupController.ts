import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { BackupError, KEEP_BACKUPS, backupFileDownloadUrl, listBackups, runBackup } from "../../../services/backupService";

/** Backups hold every customer's details: only the Super Admin can make or download them */
const superAdminOnly = (req: Request, res: Response) => {
  if ((req.user as any)?.role !== "Super Admin") {
    res.status(403).json({ success: false, message: "Only the Super Admin can manage backups" });
    return false;
  }
  return true;
};

const handle = (res: Response, error: unknown) => {
  if (error instanceof BackupError) return res.status(error.statusCode).json({ success: false, message: error.message });
  throw error;
};

// GET /admin/backups
export const getBackups = asyncHandler(async (req: Request, res: Response) => {
  if (!superAdminOnly(req, res)) return;
  return res.json({ success: true, data: await listBackups(), keep: KEEP_BACKUPS });
});

// POST /admin/backups  (backup now)
export const createBackup = asyncHandler(async (req: Request, res: Response) => {
  if (!superAdminOnly(req, res)) return;
  try {
    const backup = await runBackup("manual", req.user?.userId);
    return res.status(201).json({ success: true, message: "Backup completed", data: backup });
  } catch (error) {
    return handle(res, error);
  }
});

// GET /admin/backups/:id/files/:index/download  → short-lived signed link
export const getBackupFileLink = asyncHandler(async (req: Request, res: Response) => {
  if (!superAdminOnly(req, res)) return;
  try {
    return res.json({ success: true, data: await backupFileDownloadUrl(req.params.id, Number(req.params.index)) });
  } catch (error) {
    return handle(res, error);
  }
});
