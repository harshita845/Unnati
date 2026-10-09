import { OcrProvider, OcrRepairRequest, OcrRequest, OcrResult } from "./types";

/**
 * Offline provider for local development and tests (OCR_PROVIDER=fake). No network, no key.
 * Returns queued answers if given (tests), otherwise a realistic sample purchase bill.
 */

export const FAKE_SAMPLE_BILL = {
  docType: "purchase",
  documentTitle: "TAX INVOICE",
  invoiceNumber: "SLT/2026/0457",
  invoiceDate: "04/10/2026",
  dueDate: null,
  party: {
    name: "Sri Lakshmi Traders",
    gstin: "36AAPFU0939F1ZW",
    phone: "+91 98480 12345",
    address: "12-2-45, Kukatpally, Hyderabad",
    state: "Telangana",
  },
  items: [
    { name: "Tata Salt 1 Kg", hsn: "2501", barcode: null, quantity: 20, unit: "pcs", rate: 25, mrp: 28, discount: 0, taxRate: 0, taxAmount: 0, amount: 500, batch: null, expiry: null, confidence: 0.97 },
    { name: "Aashirvaad Atta 5kg", hsn: "1101", barcode: null, quantity: 10, unit: "pcs", rate: 240, mrp: 285, discount: 0, taxRate: 5, taxAmount: 120, amount: 2400, batch: "A2611", expiry: "2027-03-31", confidence: 0.93 },
    { name: "Fortune Sunflower Oil 1L", hsn: "1512", barcode: null, quantity: 12, unit: "pcs", rate: 135, mrp: 160, discount: 20, taxRate: 5, taxAmount: 80, amount: 1600, batch: null, expiry: null, confidence: 0.88 },
  ],
  totals: { subtotal: 4500, discount: 0, cgst: 100, sgst: 100, igst: null, cess: null, otherCharges: null, roundOff: 0, grandTotal: 4700 },
  amountInWords: "Rupees Four Thousand Seven Hundred Only",
  paymentMode: "credit",
  paymentStatus: "unpaid",
  amountPaid: 0,
  notes: null,
  confidence: { overall: 0.92, invoiceNumber: 0.95, invoiceDate: 0.9, party: 0.9, items: 0.9, totals: 0.95 },
};

export class FakeOcrProvider implements OcrProvider {
  readonly name = "fake";
  readonly model = "fake-ocr-1";
  /** Every request the fake received (tests assert on these) */
  readonly calls: Array<{ kind: "extract" | "repair"; files: number; prompt: string }> = [];

  constructor(private queue: string[] = [], private delayMs = Number(process.env.OCR_FAKE_DELAY_MS) || 0) {}

  private async answer(): Promise<OcrResult> {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    const text = this.queue.length ? this.queue.shift()! : JSON.stringify(FAKE_SAMPLE_BILL);
    return { text, model: this.model, usage: { inputTokens: 1500, outputTokens: 600 } };
  }

  extract(req: OcrRequest): Promise<OcrResult> {
    this.calls.push({ kind: "extract", files: req.files.length, prompt: req.prompt });
    return this.answer();
  }

  repair(req: OcrRepairRequest): Promise<OcrResult> {
    this.calls.push({ kind: "repair", files: 0, prompt: req.prompt });
    return this.answer();
  }
}
