import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { runExtraction } from "../../src/services/ocr/extract";
import { FakeOcrProvider, FAKE_SAMPLE_BILL } from "../../src/services/ocr/providers/fake";
import { setOcrProviderForTests, getOcrProvider, OcrProviderError } from "../../src/services/ocr/providers";

const file = { mimeType: "image/jpeg", data: Buffer.from("fake image") };
afterEach(() => setOcrProviderForTests(null));

test("good answer: one call, normalized, no repair", async () => {
  const fake = new FakeOcrProvider();
  setOcrProviderForTests(fake);
  const out = await runExtraction([file]);
  assert.equal(out.aiCalls, 1);
  assert.equal(out.repaired, false);
  assert.equal(out.extraction.invoiceDate, "2026-10-04");
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].files, 1);
});

test("broken JSON → exactly one repair retry", async () => {
  const fake = new FakeOcrProvider(['{"docType": "purchase", "items": [', JSON.stringify(FAKE_SAMPLE_BILL)]);
  setOcrProviderForTests(fake);
  const out = await runExtraction([file]);
  assert.equal(out.repaired, true);
  assert.equal(out.aiCalls, 2);
  assert.deepEqual(fake.calls.map((c) => c.kind), ["extract", "repair"]);
  assert.match(fake.calls[1].prompt, /could not be used/);
  assert.equal(out.extraction.totals.grandTotal, 4700);
});

test("broken twice → clear error, no third call", async () => {
  const fake = new FakeOcrProvider(["nope", "still nope", JSON.stringify(FAKE_SAMPLE_BILL)]);
  setOcrProviderForTests(fake);
  await assert.rejects(runExtraction([file]), (e: any) => e instanceof OcrProviderError && /manually/.test(e.message));
  assert.equal(fake.calls.length, 2);
});

test("the person's bill type wins over the AI's guess", async () => {
  setOcrProviderForTests(new FakeOcrProvider([JSON.stringify({ ...FAKE_SAMPLE_BILL, docType: "sales" })]));
  const out = await runExtraction([file], { docTypeHint: "purchase" });
  assert.equal(out.extraction.docType, "purchase");
});

test("multi-page prompt mentions the page count", async () => {
  const fake = new FakeOcrProvider();
  setOcrProviderForTests(fake);
  await runExtraction([file, file, file]);
  assert.match(fake.calls[0].prompt, /3 images\/pages/);
});

test("provider config errors without keys", () => {
  const saved = { p: process.env.OCR_PROVIDER, a: process.env.ANTHROPIC_API_KEY, g: process.env.GEMINI_API_KEY };
  try {
    process.env.OCR_PROVIDER = "anthropic";
    delete process.env.ANTHROPIC_API_KEY;
    assert.throws(() => getOcrProvider(), /ANTHROPIC_API_KEY/);
    process.env.OCR_PROVIDER = "gemini";
    delete process.env.GEMINI_API_KEY;
    assert.throws(() => getOcrProvider(), /GEMINI_API_KEY/);
    process.env.OCR_PROVIDER = "fake";
    assert.equal(getOcrProvider().name, "fake");
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.throws(() => getOcrProvider(), /not allowed in production/);
    } finally {
      if (savedEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = savedEnv;
    }
    process.env.OCR_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
    assert.equal(getOcrProvider().model, "claude-opus-5-5");
    process.env.OCR_MODEL = "claude-haiku-5-5";
    assert.equal(getOcrProvider().model, "claude-haiku-5-5");
  } finally {
    delete process.env.OCR_MODEL;
    for (const [k, v] of [["OCR_PROVIDER", saved.p], ["ANTHROPIC_API_KEY", saved.a], ["GEMINI_API_KEY", saved.g]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
