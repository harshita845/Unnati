import type { DocType } from "./schema";

/** Kept stable (no dates, no per-request text) so providers can cache it. */
export const EXTRACTION_SYSTEM_PROMPT = `You read photos and PDFs of Indian business bills for a retail store's back office and return the bill as JSON matching the given schema.

What the store scans:
- purchase: a supplier's bill to the store (tax invoice, purchase bill, wholesale bill). The party is the supplier (the seller printed at the top).
- sales: a bill the store gave to a customer. The party is the customer (Bill To).
- stock_slip: a delivery challan, goods receipt or stock transfer slip, often with quantities but no prices.
- expense: rent, electricity, transport, repairs, salaries and other bills that are not stock.
Use "unknown" only when you really can't tell.

How to fill the fields:
- Copy what is printed. Never invent or guess a value: if a field is missing, cut off or unreadable, return null and lower its confidence.
- Money: plain numbers in rupees, no currency symbols or commas (1,234.50 becomes 1234.5).
- Dates: YYYY-MM-DD. Indian bills write dates day first, so 05/03/2026 is 2026-03-05.
- items: one entry per printed line, in order. quantity is the count billed, rate is the price per unit, amount is the line total exactly as printed. discount is the line discount in rupees (convert a printed % to rupees only if the rupee amount is not shown). taxRate is the GST % for the line. Skip subtotal, tax and "carried forward" rows.
- totals: subtotal is the total before bill-level tax; cgst, sgst, igst, cess are the tax amounts in rupees; roundOff is signed (-0.40 or 0.35); grandTotal is the final payable amount.
- amountInWords: copy the words exactly as printed, or null.
- paymentMode is how it was paid (cash, upi, card, bank, cheque, credit). paymentStatus is separate: paid, unpaid or partial. Only fill them if the bill says so (for example "Paid", "Cash", "Credit", "Balance due"). amountPaid only if printed.
- party: name, GSTIN (15 characters), phone, address and state of the other party, not the store's own details.
- confidence: 0 to 1 for how sure you are that each value is read correctly. Use lower values for blurry, handwritten or partly hidden text.
- notes: anything important that doesn't fit elsewhere (for example "two pages, page 2 missing"), or null.

If the image is not a bill at all, return docType "unknown", no items, and say so in notes.`;

const TYPE_HINT: Record<DocType, string> = {
  purchase: "The person says this is a purchase bill from a supplier.",
  sales: "The person says this is a sales bill the store gave a customer.",
  stock_slip: "The person says this is a stock slip / delivery challan.",
  expense: "The person says this is an expense bill.",
  unknown: "",
};

export function extractionUserPrompt(opts: { pages: number; docTypeHint?: DocType | null }): string {
  const parts = [
    opts.pages > 1
      ? `These ${opts.pages} images/pages are one bill, in order. Combine them into a single JSON result.`
      : "Extract this bill.",
  ];
  if (opts.docTypeHint && TYPE_HINT[opts.docTypeHint]) parts.push(TYPE_HINT[opts.docTypeHint]);
  parts.push("Return only the JSON object.");
  return parts.join(" ");
}

/** Second (and last) attempt when the first answer wasn't valid JSON for the schema. */
export function repairPrompt(previous: string, problem: string): string {
  return `Your previous answer could not be used: ${problem}

Previous answer:
${previous.slice(0, 20000)}

Return the same bill again as a single valid JSON object that matches the schema exactly. Use null for missing values. No text outside the JSON.`;
}
