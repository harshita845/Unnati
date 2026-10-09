import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExtraction, ExtractionParseError, extractJsonText, EXTRACTION_JSON_SCHEMA } from "../../src/services/ocr/schema";
import { FAKE_SAMPLE_BILL } from "../../src/services/ocr/providers/fake";

test("parses fenced JSON and coerces number strings", () => {
  const raw = "Here you go:\n```json\n" + JSON.stringify({ ...FAKE_SAMPLE_BILL, totals: { ...FAKE_SAMPLE_BILL.totals, grandTotal: "₹4,700.00" } }) + "\n```";
  const e = parseExtraction(raw);
  assert.equal(e.totals.grandTotal, 4700);
  assert.equal(e.items.length, 3);
});

test("unknown enums become null / unknown instead of failing", () => {
  const e = parseExtraction(JSON.stringify({ ...FAKE_SAMPLE_BILL, docType: "Tax Invoice", paymentMode: "Paytm", paymentStatus: "PAID" }));
  assert.equal(e.docType, "unknown");
  assert.equal(e.paymentMode, null);
  assert.equal(e.paymentStatus, "paid");
});

test("confidence given as percent is scaled to 0–1", () => {
  const e = parseExtraction(JSON.stringify({ ...FAKE_SAMPLE_BILL, confidence: { ...FAKE_SAMPLE_BILL.confidence, overall: 87 } }));
  assert.equal(e.confidence.overall, 0.87);
});

test("rejects broken JSON and wrong shapes with a reason", () => {
  assert.throws(() => parseExtraction("I can't read this"), ExtractionParseError);
  assert.throws(() => parseExtraction("{ \"docType\": \"purchase\", "), /Invalid JSON|No JSON/);
  assert.throws(() => parseExtraction(JSON.stringify({ ...FAKE_SAMPLE_BILL, totals: { grandTotal: "abc" } })), /schema/);
});

test("extractJsonText finds the object inside prose", () => {
  assert.equal(extractJsonText('ok {"a":1} done'), '{"a":1}');
});

test("provider JSON schema: every object is closed and fully required", () => {
  const walk = (node: any, path: string) => {
    if (node?.type === "object") {
      assert.equal(node.additionalProperties, false, path);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), path);
      for (const [k, v] of Object.entries(node.properties)) walk(v, `${path}.${k}`);
    }
    if (node?.type === "array") walk(node.items, `${path}[]`);
  };
  walk(EXTRACTION_JSON_SCHEMA, "$");
});
