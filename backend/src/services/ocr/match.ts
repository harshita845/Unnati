import Fuse from "fuse.js";
import type { ExtractedItem, ExtractedParty } from "./schema";

/**
 * Link scanned lines to catalogue products and the scanned party to a saved supplier/customer.
 * Pure functions over plain lists (the DB loading lives in the service), so they're unit-tested.
 *
 * Status per line:
 *  - matched: barcode/SKU hit, or a near-identical name (the review screen pre-selects it)
 *  - similar: plausible candidates; the person picks one or creates a new product
 *  - new:     nothing close; quick-create or skip
 */

export interface CatalogEntry {
  productId: string;
  variationId?: string;
  name: string;
  /** Variant label, e.g. "500 g" */
  variant?: string;
  sku?: string;
  barcodes?: string[];
  hsn?: string;
  mrp?: number;
  price?: number;
  purchasePrice?: number;
  stock?: number;
  gst?: number;
}

export type MatchStatus = "matched" | "similar" | "new";

export interface MatchCandidate extends CatalogEntry {
  /** 0–1, higher is better */
  score: number;
  reason: "barcode" | "sku" | "name";
}

export interface ItemMatch {
  status: MatchStatus;
  best?: MatchCandidate;
  candidates: MatchCandidate[];
}

export const MATCH_THRESHOLDS = { matched: 0.85, similar: 0.55 } as const;

/** Lower-case, unify units and drop punctuation so "Tata Salt 1Kg." ≈ "TATA SALT 1 kg" */
export function normalizeName(s?: string | null): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/(\d)\s*(kgs?|g|gm|gms|grams?|ml|ltr|l|litres?|liters?|pcs?|n)\b/g, (_m, d, u) => {
      const unit = u.replace(/s$/, "");
      const map: Record<string, string> = { kg: "kg", g: "g", gm: "g", gram: "g", ml: "ml", ltr: "l", l: "l", litre: "l", liter: "l", pc: "pc", n: "pc" };
      return `${d} ${map[unit] ?? unit}`;
    })
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ") // keep decimal points (1.5 kg), drop other dots
    .replace(/\s+/g, " ")
    .trim();
}

const SIZE_RE = /^\d+(\.\d+)?$/;
const UNIT_WORDS = new Set(["kg", "g", "ml", "l", "pc"]);

/** "1 kg" style size of a normalized name, e.g. "5 kg" (null if none) */
function sizeOf(tokens: string[]): string | null {
  for (let i = 0; i < tokens.length - 1; i++) if (SIZE_RE.test(tokens[i]) && UNIT_WORDS.has(tokens[i + 1])) return `${tokens[i]} ${tokens[i + 1]}`;
  return null;
}

function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const tokenLike = (q: string, c: string) =>
  q === c || (q.length >= 4 && c.length >= 4 && (c.startsWith(q) || q.startsWith(c) || (q.length >= 5 && editDistanceAtMost1(q, c))));

/**
 * Word-overlap score (0–1): how many of the bill's words appear in the product name (typos and
 * shortened words allowed), with a penalty when both name a size and the sizes differ.
 * Complements Fuse, which scores long names with extra words poorly.
 */
export function tokenScore(query: string, candidate: string): number {
  const q = query.split(" ").filter(Boolean);
  const c = candidate.split(" ").filter(Boolean);
  if (!q.length || !c.length) return 0;
  const words = q.filter((t) => !SIZE_RE.test(t) && !UNIT_WORDS.has(t));
  if (!words.length) return 0;
  const hit = words.filter((t) => c.some((ct) => tokenLike(t, ct))).length;
  const covered = hit / words.length;
  const candWords = c.filter((t) => !SIZE_RE.test(t) && !UNIT_WORDS.has(t));
  const precision = candWords.length ? candWords.filter((ct) => words.some((t) => tokenLike(t, ct))).length / candWords.length : 0;
  let score = 0.8 * covered + 0.2 * precision;
  const qs = sizeOf(q);
  const cs = sizeOf(c);
  if (qs && cs) score = qs === cs ? Math.min(1, score + 0.05) : score * 0.6;
  return Math.round(score * 100) / 100;
}

const digits = (s?: string | null) => String(s ?? "").replace(/\D/g, "");

export function buildCatalogIndex(catalog: CatalogEntry[]) {
  const rows = catalog.map((c) => ({ ...c, _search: normalizeName(`${c.name} ${c.variant ?? ""}`) }));
  const fuse = new Fuse(rows, {
    keys: ["_search"],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.5,
    minMatchCharLength: 2,
  });
  const byCode = new Map<string, { entry: CatalogEntry; reason: "barcode" | "sku" }>();
  for (const c of catalog) {
    for (const b of c.barcodes ?? []) if (b) byCode.set(`b:${String(b).trim()}`, { entry: c, reason: "barcode" });
    if (c.sku) byCode.set(`s:${c.sku.trim().toLowerCase()}`, { entry: c, reason: "sku" });
  }
  return { fuse, byCode, rows };
}

export type CatalogIndex = ReturnType<typeof buildCatalogIndex>;

export function matchItem(item: Pick<ExtractedItem, "name" | "barcode">, index: CatalogIndex, limit = 5): ItemMatch {
  const code = item.barcode?.trim();
  if (code) {
    const hit = index.byCode.get(`b:${code}`) || index.byCode.get(`s:${code.toLowerCase()}`);
    if (hit) {
      const best: MatchCandidate = { ...hit.entry, score: 1, reason: hit.reason };
      return { status: "matched", best, candidates: [best] };
    }
  }
  const q = normalizeName(item.name);
  if (q.length < 2) return { status: "new", candidates: [] };

  // Best of Fuse (character-level) and word overlap, per catalogue row
  const scored = new Map<number, number>();
  index.fuse.search(q, { limit: limit * 4 }).forEach((r) => {
    scored.set(r.refIndex, r.item._search === q ? 1 : Math.max(0, 1 - (r.score ?? 1)));
  });
  index.rows.forEach((row, i) => {
    const t = row._search === q ? 1 : tokenScore(q, row._search);
    if (t > (scored.get(i) ?? 0)) scored.set(i, t);
  });
  const candidates: MatchCandidate[] = [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([i, score]) => {
      const { _search, ...entry } = index.rows[i];
      return { ...entry, score: Math.round(score * 100) / 100, reason: "name" as const };
    });
  const best = candidates[0];
  if (!best || best.score < MATCH_THRESHOLDS.similar) return { status: "new", candidates: candidates.filter((c) => c.score >= 0.35) };
  // Two near-equal top candidates (e.g. 500 g and 1 kg of the same thing): let the person pick
  const ambiguous = candidates[1] && best.score - candidates[1].score < 0.03 && candidates[1].productId !== best.productId;
  if (best.score >= MATCH_THRESHOLDS.matched && !ambiguous) return { status: "matched", best, candidates };
  return { status: "similar", best, candidates };
}

export function matchItems(items: Array<Pick<ExtractedItem, "name" | "barcode">>, catalog: CatalogEntry[]): ItemMatch[] {
  const index = buildCatalogIndex(catalog);
  return items.map((it) => matchItem(it, index));
}

// ---------------------------------------------------------------------------------------------

export interface PartyEntry {
  id: string;
  name: string;
  phone?: string;
  gstin?: string;
  address?: string;
  balance?: number;
}

export interface PartyMatch {
  status: MatchStatus;
  best?: PartyEntry & { score: number; reason: "gstin" | "phone" | "name" };
  candidates: Array<PartyEntry & { score: number; reason: "gstin" | "phone" | "name" }>;
}

export function matchParty(party: Pick<ExtractedParty, "name" | "gstin" | "phone">, parties: PartyEntry[]): PartyMatch {
  const gstin = (party.gstin || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (gstin.length === 15) {
    const hit = parties.find((p) => (p.gstin || "").toUpperCase().replace(/[^0-9A-Z]/g, "") === gstin);
    if (hit) {
      const best = { ...hit, score: 1, reason: "gstin" as const };
      return { status: "matched", best, candidates: [best] };
    }
  }
  const phone = digits(party.phone).slice(-10);
  if (phone.length === 10) {
    const hit = parties.find((p) => digits(p.phone).slice(-10) === phone);
    if (hit) {
      const best = { ...hit, score: 0.95, reason: "phone" as const };
      return { status: "matched", best, candidates: [best] };
    }
  }
  const q = normalizeName(party.name);
  if (q.length < 2 || !parties.length) return { status: "new", candidates: [] };
  const fuse = new Fuse(parties.map((p) => ({ ...p, _search: normalizeName(p.name) })), {
    keys: ["_search"],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.45,
  });
  const candidates = fuse.search(q, { limit: 5 }).map((r) => {
    const { _search, ...p } = r.item as PartyEntry & { _search: string };
    const score = _search === q ? 1 : Math.max(0, 1 - (r.score ?? 1), tokenScore(q, _search) * 0.95);
    return { ...p, score: Math.round(score * 100) / 100, reason: "name" as const };
  });
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score < MATCH_THRESHOLDS.similar) return { status: "new", candidates };
  return { status: best.score >= 0.9 ? "matched" : "similar", best, candidates };
}
