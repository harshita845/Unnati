import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Database, Download, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { DataBackupRecord, getBackupFileLink, listBackups, startBackup } from "../../../services/api/admin/gstReturnBackupService";

const size = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "-";
const apiMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/**
 * Super Admin: full database backups. A backup runs automatically every night (02:30 IST) and on
 * "Back up now". Files are private: each download uses a link valid for 10 minutes.
 */
export default function AdminDataBackup() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = (user as { role?: string } | null)?.role === "Super Admin";
  const [backups, setBackups] = useState<DataBackupRecord[]>([]);
  const [keep, setKeep] = useState(7);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listBackups();
      setBackups(res.data);
      setKeep(res.keep);
    } catch (e) {
      showToast(apiMessage(e, "Couldn't load backups"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isSuperAdmin) load();
    else setLoading(false);
  }, [isSuperAdmin, load]);

  const backupNow = async () => {
    setRunning(true);
    try {
      const b = await startBackup();
      showToast(`Backup completed: ${b.totalDocuments.toLocaleString("en-IN")} records`, "success");
    } catch (e) {
      showToast(apiMessage(e, "Backup failed"), "error");
    } finally {
      setRunning(false);
      load();
    }
  };

  const download = async (backupId: string, index: number) => {
    try {
      const { url } = await getBackupFileLink(backupId, index);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      showToast(apiMessage(e, "Couldn't get the download link"), "error");
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Only the Super Admin can manage data backups.</p>
      </div>
    );
  }

  const latest = backups.find((b) => b.status === "done");

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Database size={22} /> Data Backup
          </h1>
          <p className="text-sm text-gray-500">Full copies of all your data, made automatically every night and whenever you choose.</p>
        </div>
        <button
          type="button"
          onClick={backupNow}
          disabled={running}
          className="flex items-center gap-2 rounded-lg bg-[var(--primary-dark)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
          {running ? "Backing up… (can take a few minutes)" : "Back up now"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 px-4 py-3" style={{ backgroundColor: "#ffffff" }}>
          <div className="text-xs font-semibold text-gray-500">Last backup</div>
          <div className="mt-1 text-base font-bold text-gray-900">{latest ? when(latest.finishedAt) : "None yet"}</div>
          {latest && (
            <div className="text-xs text-gray-500">
              {latest.totalDocuments.toLocaleString("en-IN")} records · {latest.collectionsCount} tables · {size(latest.totalBytes)}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 px-4 py-3" style={{ backgroundColor: "#ffffff" }}>
          <div className="text-xs font-semibold text-gray-500">Schedule</div>
          <div className="mt-1 text-base font-bold text-gray-900">Every night at 02:30</div>
          <div className="text-xs text-gray-500">The newest {keep} backups are kept; older ones are deleted.</div>
        </div>
        <div className="rounded-lg border border-gray-200 px-4 py-3" style={{ backgroundColor: "#ffffff" }}>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <ShieldCheck size={14} /> Security
          </div>
          <div className="mt-1 text-sm text-gray-700">Stored privately. Each download link works for 10 minutes and only for the Super Admin.</div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200" style={{ backgroundColor: "#ffffff" }}>
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-900">Backups</div>
        {loading ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </p>
        ) : backups.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No backups yet. Click “Back up now” to make the first one.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {backups.map((b) => (
              <li key={b._id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                  onClick={() => setOpen((o) => (o === b._id ? null : b._id))}
                  disabled={b.status !== "done"}
                >
                  {b.status === "done" ? (
                    open === b._id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />
                  ) : (
                    <span className="w-4" />
                  )}
                  <span className="min-w-[180px] text-sm font-semibold text-gray-900">{when(b.startedAt)}</span>
                  {b.status === "done" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={13} /> Completed
                    </span>
                  )}
                  {b.status === "running" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                      <Loader2 size={13} className="animate-spin" /> Running
                    </span>
                  )}
                  {b.status === "failed" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600" title={b.error}>
                      <XCircle size={13} /> Failed
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{b.trigger === "scheduled" ? "Automatic" : "Manual"}</span>
                  {b.status === "done" && (
                    <span className="ml-auto text-xs text-gray-500">
                      {b.totalDocuments.toLocaleString("en-IN")} records · {size(b.totalBytes)}
                    </span>
                  )}
                  {b.status === "failed" && b.error && <span className="ml-auto max-w-md truncate text-xs text-red-600">{b.error}</span>}
                </button>
                {open === b._id && (
                  <div className="overflow-x-auto bg-gray-50 px-4 pb-3">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          <th className="py-2">Table</th>
                          <th className="py-2 text-right">Records</th>
                          <th className="py-2 text-right">Size</th>
                          <th className="py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {b.files.map((f, i) => (
                          <tr key={`${f.collectionName}-${f.part}`}>
                            <td className="py-1.5 text-gray-800">
                              {f.collectionName}
                              {b.files.filter((x) => x.collectionName === f.collectionName).length > 1 ? ` (part ${f.part})` : ""}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-gray-700">{f.documents.toLocaleString("en-IN")}</td>
                            <td className="py-1.5 text-right tabular-nums text-gray-700">{size(f.bytes)}</td>
                            <td className="py-1.5 text-right">
                              <button type="button" onClick={() => download(b._id, i)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-[var(--primary-dark)] hover:bg-white">
                                <Download size={13} /> Download
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
