import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GeminiOcrProvider } from "../../src/services/ocr/providers/gemini";
import { OcrProviderError } from "../../src/services/ocr/providers";

// Google's answers are faked: which model was asked, and what it says back

const realFetch = globalThis.fetch;
afterEach(() => (globalThis.fetch = realFetch));

const quota = (perDay: boolean) => ({
  error: {
    code: 429,
    status: "RESOURCE_EXHAUSTED",
    message: "You exceeded your current quota, please check your plan and billing details.",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [{ quotaId: perDay ? "GenerateRequestsPerDayPerProjectPerModel-FreeTier" : "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }],
      },
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: perDay ? "39371s" : "20s" },
    ],
  },
});
const ok = { candidates: [{ content: { parts: [{ text: '{"docType":"purchase"}' }] } }], modelVersion: "fallback" };

function fakeGoogle(answers: Record<string, () => { status: number; body: unknown }>) {
  const asked: string[] = [];
  globalThis.fetch = (async (url: string) => {
    const model = decodeURIComponent(String(url).split("/models/")[1].split(":")[0]);
    asked.push(model);
    const { status, body } = answers[model]();
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return asked;
}

const req = { files: [{ mimeType: "image/jpeg", data: Buffer.from("x") }], system: "s", prompt: "p", schema: {}, timeoutMs: 60000 };

test("main model out of daily quota: goes straight to the other model", async () => {
  const asked = fakeGoogle({
    "main-a": () => ({ status: 429, body: quota(true) }),
    "spare-a": () => ({ status: 200, body: ok }),
  });
  const out = await new GeminiOcrProvider("k", "main-a", "spare-a", null).extract(req);
  assert.equal(out.text, '{"docType":"purchase"}');
  assert.deepEqual(asked, ["main-a", "spare-a"]);
});

test("main and fallback out of daily quota: the last-resort model reads the bill", async () => {
  const asked = fakeGoogle({
    "main-d": () => ({ status: 429, body: quota(true) }),
    "spare-d": () => ({ status: 429, body: quota(true) }),
    "lite-d": () => ({ status: 200, body: ok }),
  });
  const out = await new GeminiOcrProvider("k", "main-d", "spare-d", "lite-d").extract(req);
  assert.equal(out.text, '{"docType":"purchase"}');
  assert.deepEqual(asked, ["main-d", "spare-d", "lite-d"]);
});

test("every model out of daily quota: says so once, no repeated tries", async () => {
  const asked = fakeGoogle({
    "main-b": () => ({ status: 429, body: quota(true) }),
    "spare-b": () => ({ status: 429, body: quota(true) }),
    "lite-b": () => ({ status: 429, body: quota(true) }),
  });
  await assert.rejects(new GeminiOcrProvider("k", "main-b", "spare-b", "lite-b").extract(req), (e: any) => {
    assert.ok(e instanceof OcrProviderError);
    assert.equal(e.kind, "config");
    assert.match(e.message, /limit on the Gemini key is used up \(resets in about 11 hours\)/);
    assert.match(e.message, /billing/);
    return true;
  });
  assert.deepEqual(asked, ["main-b", "spare-b", "lite-b"]);
});

test("a per-minute rate limit is still treated as busy and retried", async () => {
  let calls = 0;
  const asked = fakeGoogle({
    "main-c": () => (++calls === 1 ? { status: 429, body: quota(false) } : { status: 200, body: ok }),
    "spare-c": () => ({ status: 200, body: ok }),
  });
  const out = await new GeminiOcrProvider("k", "main-c", "spare-c", null).extract(req);
  assert.equal(out.text, '{"docType":"purchase"}');
  assert.deepEqual(asked, ["main-c", "spare-c"]);
});
