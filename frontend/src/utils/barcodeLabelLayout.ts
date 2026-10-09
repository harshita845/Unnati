/**
 * Barcode label page setup, shared by the live preview, the PDFs and printing so they all
 * place labels identically. All values are millimetres.
 *
 * Label roll (thermal printers): one page = `rows` rows of `columns` labels; the page size
 * is worked out from the labels, margins and gaps (e.g. 2 × 50.8 mm labels + 1.3 mm margins
 * each side = 104.1 mm wide).
 * A4 sheet: fixed 210 × 297 mm page; as many rows as fit between the top and bottom margins.
 */

export type LabelPaper = "roll" | "a4";

export interface LabelPageLayout {
  paper: LabelPaper;
  columns: number;
  /** Rows per page (label roll only; A4 fits as many as possible) */
  rows: number;
  labelWidth: number;
  labelHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  /** Space between two labels side by side */
  gapX: number;
  /** Space between two rows of labels */
  gapY: number;
  /** Draw a thin outline around each label (handy on plain A4, usually off on die-cut rolls) */
  border: boolean;
}

export const A4_MM = { width: 210, height: 297 } as const;

export const LABEL_SIZE_PRESETS: Array<{ id: string; label: string; width: number; height: number }> = [
  { id: "38x25", label: "Compact (38 × 25 mm)", width: 38, height: 25 },
  { id: "50x25", label: "50 × 25 mm", width: 50, height: 25 },
  { id: "50.8x25", label: "2 inch × 1 inch (50.8 × 25 mm)", width: 50.8, height: 25 },
  { id: "50x30", label: "Standard (50 × 30 mm)", width: 50, height: 30 },
  { id: "60x40", label: "Large (60 × 40 mm)", width: 60, height: 40 },
];

export const DEFAULT_LABEL_LAYOUT: LabelPageLayout = {
  paper: "roll",
  columns: 2,
  rows: 1,
  labelWidth: 50,
  labelHeight: 30,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 1.5,
  marginRight: 1.5,
  gapX: 2,
  gapY: 2,
  border: false,
};

const LIMITS = {
  columns: [1, 4],
  rows: [1, 30],
  labelWidth: [10, 200],
  labelHeight: [10, 200],
  margin: [0, 50],
  gap: [0, 50],
} as const;

const clamp = (n: unknown, [min, max]: readonly [number, number], fallback: number) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v * 10) / 10));
};

/** Fill gaps and keep every value in a sensible range (bad input never breaks a print). */
export const normalizeLabelLayout = (input?: Partial<LabelPageLayout> | null): LabelPageLayout => {
  const d = DEFAULT_LABEL_LAYOUT;
  const l = input || {};
  return {
    paper: l.paper === "a4" ? "a4" : "roll",
    columns: Math.round(clamp(l.columns, LIMITS.columns, d.columns)),
    rows: Math.round(clamp(l.rows, LIMITS.rows, d.rows)),
    labelWidth: clamp(l.labelWidth, LIMITS.labelWidth, d.labelWidth),
    labelHeight: clamp(l.labelHeight, LIMITS.labelHeight, d.labelHeight),
    marginTop: clamp(l.marginTop, LIMITS.margin, d.marginTop),
    marginBottom: clamp(l.marginBottom, LIMITS.margin, d.marginBottom),
    marginLeft: clamp(l.marginLeft, LIMITS.margin, d.marginLeft),
    marginRight: clamp(l.marginRight, LIMITS.margin, d.marginRight),
    gapX: clamp(l.gapX, LIMITS.gap, d.gapX),
    gapY: clamp(l.gapY, LIMITS.gap, d.gapY),
    border: typeof l.border === "boolean" ? l.border : d.border,
  };
};

export interface ComputedLabelLayout extends LabelPageLayout {
  pageWidth: number;
  pageHeight: number;
  rowsPerPage: number;
  perPage: number;
  /** Problems that would make labels fall off the page (A4 only) */
  problems: string[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export const computeLabelLayout = (input?: Partial<LabelPageLayout> | null): ComputedLabelLayout => {
  const l = normalizeLabelLayout(input);
  const rowWidth = l.marginLeft + l.columns * l.labelWidth + (l.columns - 1) * l.gapX + l.marginRight;
  const problems: string[] = [];

  if (l.paper === "roll") {
    const pageHeight = l.marginTop + l.rows * l.labelHeight + (l.rows - 1) * l.gapY + l.marginBottom;
    return { ...l, pageWidth: r1(rowWidth), pageHeight: r1(pageHeight), rowsPerPage: l.rows, perPage: l.columns * l.rows, problems };
  }

  const usableHeight = A4_MM.height - l.marginTop - l.marginBottom;
  const rowsPerPage = Math.max(0, Math.floor((usableHeight + l.gapY) / (l.labelHeight + l.gapY)));
  if (rowWidth > A4_MM.width + 0.01) {
    problems.push(`${l.columns} labels of ${l.labelWidth} mm plus margins and gaps need ${r1(rowWidth)} mm, wider than A4 (210 mm).`);
  }
  if (rowsPerPage < 1) problems.push("The label is taller than the space between the top and bottom margins.");
  return {
    ...l,
    pageWidth: A4_MM.width,
    pageHeight: A4_MM.height,
    rowsPerPage: Math.max(1, rowsPerPage),
    perPage: l.columns * Math.max(1, rowsPerPage),
    problems,
  };
};

/** Top-left corner (mm) of the label at `index` (0-based, across the whole print job). */
export const labelSlot = (layout: ComputedLabelLayout, index: number) => {
  const onPage = index % layout.perPage;
  const col = onPage % layout.columns;
  const row = Math.floor(onPage / layout.columns);
  return {
    page: Math.floor(index / layout.perPage),
    x: r1(layout.marginLeft + col * (layout.labelWidth + layout.gapX)),
    y: r1(layout.marginTop + row * (layout.labelHeight + layout.gapY)),
  };
};

export const labelPageCount = (layout: ComputedLabelLayout, totalLabels: number) =>
  totalLabels <= 0 ? 0 : Math.ceil(totalLabels / layout.perPage);

/** Font/barcode sizes for a label, scaled from a 50 × 30 mm reference label. */
export const labelContentScale = (labelWidth: number, labelHeight: number) =>
  Math.min(1.6, Math.max(0.6, Math.min(labelHeight / 30, labelWidth / 50)));

const STORAGE_KEY = "barcode_label_layout_v1";

export const readStoredLabelLayout = (): Partial<LabelPageLayout> | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const storeLabelLayout = (layout: LabelPageLayout) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* storage blocked: the saved server copy still applies */
  }
};

/**
 * The page setup to start from: the server copy (Barcode Settings) wins, then this browser's
 * last-used setup, then defaults. The label size comes from Barcode Settings width/height.
 */
export const initialLabelLayout = (barcodeSettings?: any): LabelPageLayout => {
  const server = barcodeSettings?.layout && typeof barcodeSettings.layout === "object" ? barcodeSettings.layout : null;
  const local = readStoredLabelLayout();
  const size =
    barcodeSettings?.width && barcodeSettings?.height
      ? { labelWidth: Number(barcodeSettings.width), labelHeight: Number(barcodeSettings.height) }
      : {};
  return normalizeLabelLayout({ ...DEFAULT_LABEL_LAYOUT, ...(local || {}), ...(server || {}), ...size });
};
