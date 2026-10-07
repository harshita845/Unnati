import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { BannerStatus } from '../../../../services/api/admin/customerDisplayService';

const STATUS_STYLES: Record<BannerStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  scheduled: { label: 'Scheduled', className: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  expired: { label: 'Expired', className: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
  inactive: { label: 'Disabled', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
};

export const StatusBadge = ({ status }: { status: BannerStatus }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.className}`}>{s.label}</span>;
};

const formatDay = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const formatDayRange = (start: string | null, end: string | null) => {
  if (!start && !end) return 'Always';
  if (start && !end) return `From ${formatDay(start)}`;
  if (!start && end) return `Until ${formatDay(end)}`;
  return start === end ? formatDay(start!) : `${formatDay(start!)} – ${formatDay(end!)}`;
};

export const Toggle = ({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
      checked ? 'bg-[var(--primary-color)]' : 'bg-gray-300'
    }`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

export const Modal = ({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={`flex max-h-[92vh] w-full flex-col rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t bg-gray-50 px-6 py-3">{footer}</div>}
    </div>
  </div>
);

export const Field = ({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) => (
  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
  </div>
);

export const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[var(--primary-color)]';

export const apiError = (err: any, fallback: string) => err?.response?.data?.message || fallback;
