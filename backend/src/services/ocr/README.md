# Scan Bill (AI bill reading)

Admin POS → **Scan Bill**: upload photos or PDFs of a bill, AI reads it into strict JSON, the
admin reviews and fixes it, and **Confirm** posts it to the right place in one database
transaction.

| Bill type    | Confirm does                                                                 |
| ------------ | ---------------------------------------------------------------------------- |
| `purchase`   | Stock **in** + purchase price, Purchase Entry (shows in Purchase Report), supplier ledger (optional) |
| `stock_slip` | Stock in or out only                                                          |
| `sales`      | POS order (POS Report, reprint, customer credit) + stock **out**              |
| `expense`    | Stored with the scan only (no expense module yet)                             |

## Flow

```
browser ──(signed direct upload, private)──▶ Cloudinary  (Vercel caps request bodies at 4.5 MB)
browser ── POST /scan {files:[{publicId…}]} ─▶ server ─ fetch bytes ─▶ AI provider ─▶ JSON
                                                │  zod check → 1 repair retry → normalize → validate
                                                │  → fuzzy match items/party → duplicate check
                                                ▼
                                       ScannedDocument (draft)
browser ── PUT /:id (edits) ─▶ warnings re-checked
browser ── POST /:id/confirm ─▶ one transaction: draft→confirmed + stock + ledgers + entry/order
```

Confirm is **idempotent**: the transaction starts with a conditional `draft → confirmed`
update, so double clicks, retries and parallel requests post the bill exactly once (the others
get `200 alreadyConfirmed`). Any failure rolls everything back and the scan stays a draft.

## Files

- `providers/` – `anthropic.ts` (Claude, `@anthropic-ai/sdk`), `gemini.ts` (REST), `fake.ts` (offline), `index.ts` (picks from env)
- `prompt.ts` – system prompt (stable, cacheable) + per-request prompt + repair prompt
- `schema.ts` – zod schema, JSON Schema sent to the provider, tolerant parser
- `validate.ts` – date/GSTIN/phone normalization; checks (line maths, subtotal, total, CGST=SGST, words vs total, future date, payment)
- `amountInWords.ts` – words ⇄ number, Indian system (lakh/crore)
- `match.ts` + `catalog.ts` – fuse.js + word-overlap matching of items (barcode/SKU first) and parties (GSTIN, phone, name)
- `review.ts` – the edited-bill schema, confirm blockers
- `confirm.ts`, `sales.ts` – the transaction
- `storage.ts` – Cloudinary signed upload/download (authenticated assets)
- Model: `models/ScannedDocument.ts` · Controller: `modules/ocr/ocrController.ts` · Routes: `routes/ocrRoutes.ts`

## API — `/api/v1/admin/pos/ocr` (admin token)

| Method | Path                 | What                                                                 |
| ------ | -------------------- | -------------------------------------------------------------------- |
| GET    | `/config`            | AI on/off, provider, model, limits (never keys)                      |
| GET    | `/usage`             | AI calls this month vs `OCR_MONTHLY_LIMIT`, tokens                    |
| POST   | `/upload-signature`  | Cloudinary signature for a direct, private upload                    |
| POST   | `/scan`              | `{files, docType?}` or `{manual:true, docType}`. Rate limited        |
| GET    | `/`                  | History: `status, docType, q, from, to, page, limit`                 |
| GET    | `/:id`               | One scan + signed preview links                                      |
| PUT    | `/:id`               | `{data}` save edits, returns fresh warnings                           |
| POST   | `/:id/rescan`        | Read the stored files again                                          |
| POST   | `/:id/rematch`       | Re-run product/party matching on `{data}`                            |
| POST   | `/:id/confirm`       | `{data?, syncLedger?}` post it (idempotent)                          |
| POST   | `/:id/sync-ledger`   | `{supplierId?}` post a confirmed purchase to the supplier ledger later |
| GET    | `/:id/export`        | `format=csv` or `json` (PDF is made in the browser)                   |
| DELETE | `/:id`               | Discard an unsaved scan (deletes its files)                          |

Items in `data.items[]` carry `action`: `link` (with `productId`, `variationId`), `create`
(quick-create in the Admin Store, needs `name`, optional `categoryId`, `sellingPrice`) or `skip`.

## Environment

See `backend/.env.example`. `OCR_PROVIDER=fake` is refused when `NODE_ENV=production`
(it would post a made-up bill into real stock and ledgers). Keys are read only on the server. They are never sent to the
browser and never logged. Bill images are never logged either.

## Tests

```
npm run test:ocr      # unit: words, GSTIN, dates, checks, JSON repair, matching, review rules
```
The end-to-end suite (real server + in-memory MongoDB replica set + fake provider) covers scan →
edit → confirm, idempotency, parallel confirms, rollback, sales/stock slip/expense, ledger sync,
history, export, limits and "no image bytes in logs".
