import { z } from "zod";

/**
 * The bill shape the AI must return (strict JSON), plus the zod validator that checks it.
 * One schema serves every document type; fields that don't apply are null.
 *
 * Money is in rupees as plain numbers, dates are YYYY-MM-DD. The model is told to copy what is
 * printed and never invent values: anything unreadable comes back null with low confidence.
 */

export const DOC_TYPES = ["purchase", "sales", "stock_slip", "expense", "unknown"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const PAYMENT_MODES = ["cash", "upi", "card", "bank", "cheque", "credit", "other"] as const;
export const PAYMENT_STATUSES = ["paid", "unpaid", "partial"] as const;

/** Numbers sometimes come back as "1,234.50" or "₹ 99": accept those, reject junk. */
const num = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[₹,\s]|rs\.?|inr/gi, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : v; // leave junk so zod reports it
  }
  return v;
}, z.number().nullable());

const str = z.preprocess(
  (v) => (v === undefined || v === null ? null : typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() || null : v),
  z.string().nullable()
);

const conf = z.preprocess((v) => {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
}, z.number().nullable());

const lowerEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    const s = String(v).trim().toLowerCase().replace(/[\s-]+/g, "_");
    return (values as readonly string[]).includes(s) ? s : null;
  }, z.enum(values).nullable());

export const PartySchema = z.object({
  name: str,
  gstin: str,
  phone: str,
  address: str,
  state: str,
});

export const ItemSchema = z.object({
  name: str,
  hsn: str,
  barcode: str,
  quantity: num,
  unit: str,
  rate: num,
  mrp: num,
  discount: num,
  taxRate: num,
  taxAmount: num,
  amount: num,
  batch: str,
  expiry: str,
  confidence: conf,
});

export const ExtractionSchema = z.object({
  docType: z.preprocess((v) => {
    const s = String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    return (DOC_TYPES as readonly string[]).includes(s) ? s : "unknown";
  }, z.enum(DOC_TYPES)),
  documentTitle: str,
  invoiceNumber: str,
  invoiceDate: str,
  dueDate: str,
  party: PartySchema,
  items: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(ItemSchema)),
  totals: z.object({
    subtotal: num,
    discount: num,
    cgst: num,
    sgst: num,
    igst: num,
    cess: num,
    otherCharges: num,
    roundOff: num,
    grandTotal: num,
  }),
  amountInWords: str,
  paymentMode: lowerEnum(PAYMENT_MODES),
  paymentStatus: lowerEnum(PAYMENT_STATUSES),
  amountPaid: num,
  notes: str,
  confidence: z.object({
    overall: conf,
    invoiceNumber: conf,
    invoiceDate: conf,
    party: conf,
    items: conf,
    totals: conf,
  }),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractedItem = z.infer<typeof ItemSchema>;
export type ExtractedParty = z.infer<typeof PartySchema>;

// ---------------------------------------------------------------------------------------------
// JSON Schema sent to the provider (structured output). Every field is required and nullable,
// with additionalProperties false, which both Claude and Gemini structured outputs accept.

const nStr = { type: ["string", "null"] } as const;
const nNum = { type: ["number", "null"] } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const EXTRACTION_JSON_SCHEMA = obj({
  docType: { type: "string", enum: [...DOC_TYPES] },
  documentTitle: nStr,
  invoiceNumber: nStr,
  invoiceDate: nStr,
  dueDate: nStr,
  party: obj({ name: nStr, gstin: nStr, phone: nStr, address: nStr, state: nStr }),
  items: {
    type: "array",
    items: obj({
      name: nStr,
      hsn: nStr,
      barcode: nStr,
      quantity: nNum,
      unit: nStr,
      rate: nNum,
      mrp: nNum,
      discount: nNum,
      taxRate: nNum,
      taxAmount: nNum,
      amount: nNum,
      batch: nStr,
      expiry: nStr,
      confidence: nNum,
    }),
  },
  totals: obj({
    subtotal: nNum,
    discount: nNum,
    cgst: nNum,
    sgst: nNum,
    igst: nNum,
    cess: nNum,
    otherCharges: nNum,
    roundOff: nNum,
    grandTotal: nNum,
  }),
  amountInWords: nStr,
  paymentMode: { type: ["string", "null"], enum: [...PAYMENT_MODES, null] },
  paymentStatus: { type: ["string", "null"], enum: [...PAYMENT_STATUSES, null] },
  amountPaid: nNum,
  notes: nStr,
  confidence: obj({ overall: nNum, invoiceNumber: nNum, invoiceDate: nNum, party: nNum, items: nNum, totals: nNum }),
});

// ---------------------------------------------------------------------------------------------
// Parsing the provider's text into an Extraction

export class ExtractionParseError extends Error {
  constructor(message: string, readonly raw: string) {
    super(message);
    this.name = "ExtractionParseError";
  }
}

/** Pull the JSON object out of the model text (tolerates ```json fences or a sentence around it). */
export function extractJsonText(raw: string): string {
  const text = String(raw ?? "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ExtractionParseError("No JSON object in the AI response", text);
  return body.slice(start, end + 1);
}

/** Parse + validate. Throws ExtractionParseError with a short reason the repair prompt can use. */
export function parseExtraction(raw: string): Extraction {
  let json: unknown;
  try {
    json = JSON.parse(extractJsonText(raw));
  } catch (e: any) {
    if (e instanceof ExtractionParseError) throw e;
    throw new ExtractionParseError(`Invalid JSON: ${e?.message || "parse error"}`, raw);
  }
  const result = ExtractionSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new ExtractionParseError(`JSON does not match the schema: ${issues}`, raw);
  }
  return result.data;
}

/** An empty bill: the manual-entry starting point when AI is off or failed. */
export function emptyExtraction(docType: DocType = "purchase"): Extraction {
  return {
    docType,
    documentTitle: null,
    invoiceNumber: null,
    invoiceDate: null,
    dueDate: null,
    party: { name: null, gstin: null, phone: null, address: null, state: null },
    items: [],
    totals: { subtotal: null, discount: null, cgst: null, sgst: null, igst: null, cess: null, otherCharges: null, roundOff: null, grandTotal: null },
    amountInWords: null,
    paymentMode: null,
    paymentStatus: null,
    amountPaid: null,
    notes: null,
    confidence: { overall: null, invoiceNumber: null, invoiceDate: null, party: null, items: null, totals: null },
  };
}
