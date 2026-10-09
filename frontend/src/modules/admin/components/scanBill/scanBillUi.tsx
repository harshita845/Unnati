import { Check, Loader2 } from 'lucide-react';
import type { MatchStatus, ScanStatus } from '../../../../services/api/admin/scanBillService';
import { confidenceTone } from '../../scanBill/billMath';

/** Small shared pieces of the Scan Bill screens. */

export const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-[#6DBB2D] focus:ring-2 focus:ring-[#6DBB2D]/20 disabled:bg-gray-50 disabled:text-gray-500';

export const btn = {
  primary: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6DBB2D] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#5ea626] disabled:cursor-not-allowed disabled:opacity-50',
  secondary: 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50',
  danger: 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40',
};

const MATCH_STYLE: Record<MatchStatus | 'create' | 'skip', { label: string; cls: string; title: string }> = {
  matched: { label: 'Matched', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', title: 'Linked to a product in your catalogue' },
  similar: { label: 'Similar', cls: 'bg-amber-100 text-amber-800 border-amber-200', title: 'Looks like a product you have. Check it is the right one' },
  new: { label: 'New', cls: 'bg-sky-100 text-sky-700 border-sky-200', title: 'Not in your catalogue. Create it or skip the line' },
  create: { label: 'Create', cls: 'bg-violet-100 text-violet-700 border-violet-200', title: 'A new product will be created on save' },
  skip: { label: 'Skip', cls: 'bg-gray-100 text-gray-500 border-gray-200', title: 'No stock change for this line' },
};

export const MatchBadge = ({ status }: { status: keyof typeof MATCH_STYLE }) => {
  const s = MATCH_STYLE[status];
  return (
    <span title={s.title} className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
};

/** Coloured dot showing how sure the AI was about a value (hover for the %). */
export const ConfidenceDot = ({ value }: { value?: number | null }) => {
  const tone = confidenceTone(value);
  if (!tone) return null;
  const cls = tone === 'high' ? 'bg-emerald-500' : tone === 'medium' ? 'bg-amber-400' : 'bg-red-500';
  const label = tone === 'high' ? 'AI is confident' : tone === 'medium' ? 'AI is fairly sure. Check it' : 'Hard to read. Check it';
  return <span title={`${label} (${Math.round((value || 0) * 100)}%)`} className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
};

const STATUS_STYLE: Record<ScanStatus, { label: string; cls: string }> = {
  processing: { label: 'Reading', cls: 'bg-sky-100 text-sky-700' },
  draft: { label: 'To review', cls: 'bg-amber-100 text-amber-800' },
  failed: { label: 'Needs entry', cls: 'bg-red-100 text-red-700' },
  syncing: { label: 'Saving', cls: 'bg-sky-100 text-sky-700' },
  confirmed: { label: 'Saved', cls: 'bg-emerald-100 text-emerald-700' },
  discarded: { label: 'Discarded', cls: 'bg-gray-100 text-gray-500' },
};

export const StatusPill = ({ status }: { status: ScanStatus }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status].cls}`}>{STATUS_STYLE[status].label}</span>
);

export type StepState = 'done' | 'active' | 'todo' | 'error';

export const Stepper = ({ steps }: { steps: Array<{ label: string; state: StepState; hint?: string }> }) => (
  <ol className="flex w-full items-start">
    {steps.map((s, i) => (
      <li key={s.label} className="flex flex-1 flex-col items-center text-center">
        <div className="flex w-full items-center">
          <div className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : s.state === 'todo' ? 'bg-gray-200' : 'bg-[#6DBB2D]'}`} />
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
              s.state === 'done'
                ? 'border-[#6DBB2D] bg-[#6DBB2D] text-white'
                : s.state === 'active'
                  ? 'border-[#6DBB2D] bg-white text-[#6DBB2D]'
                  : s.state === 'error'
                    ? 'border-red-500 bg-red-500 text-white'
                    : 'border-gray-300 bg-white text-gray-400'
            }`}
          >
            {s.state === 'done' ? <Check size={14} /> : s.state === 'active' ? <Loader2 size={14} className="animate-spin" /> : s.state === 'error' ? '!' : i + 1}
          </span>
          <div className={`h-0.5 flex-1 ${i === steps.length - 1 ? 'invisible' : steps[i + 1].state === 'todo' ? 'bg-gray-200' : 'bg-[#6DBB2D]'}`} />
        </div>
        <span className={`mt-1.5 text-[11px] font-semibold ${s.state === 'todo' ? 'text-gray-400' : s.state === 'error' ? 'text-red-600' : 'text-gray-800'}`}>{s.label}</span>
        {s.hint && <span className="text-[10px] text-gray-500">{s.hint}</span>}
      </li>
    ))}
  </ol>
);

/** Image with a moving scan line while the AI reads it. */
export const ScanningImage = ({ src, active }: { src?: string | null; active: boolean }) => (
  <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-inner">
    {src ? <img src={src} alt="Bill being read" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-sm text-gray-400">PDF</div>}
    {active && (
      <>
        <div className="pointer-events-none absolute inset-0 bg-[#6DBB2D]/5" />
        <div className="scanbill-line pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-[#6DBB2D]/35 to-transparent">
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#6DBB2D] shadow-[0_0_12px_2px_rgba(109,187,45,0.8)]" />
        </div>
        <style>{`
          @keyframes scanbill-sweep { 0% { top: -4rem; } 100% { top: 100%; } }
          .scanbill-line { animation: scanbill-sweep 2.2s ease-in-out infinite alternate; }
          @media (prefers-reduced-motion: reduce) { .scanbill-line { animation: none; top: 45%; } }
        `}</style>
      </>
    )}
  </div>
);

export const EmptyState = ({ icon, title, text, action }: { icon: JSX.Element; title: string; text: string; action?: JSX.Element }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#6DBB2D]/10 text-[#6DBB2D]">{icon}</div>
    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    <p className="mt-1 max-w-sm text-xs text-gray-500">{text}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const apiMessage = (err: any, fallback: string): string => {
  const d = err?.response?.data;
  if (d?.details?.length) return `${d.message || fallback} ${d.details.join(' ')}`;
  if (err?.code === 'ECONNABORTED') return 'The server took too long. Check your connection and try again.';
  return d?.message || err?.message || fallback;
};
