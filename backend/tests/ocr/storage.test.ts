import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Dummy credentials so URLs can be signed; fetch is stubbed, nothing leaves the machine
process.env.CLOUDINARY_CLOUD_NAME = "demo-cloud";
process.env.CLOUDINARY_API_KEY = "111111111111111";
process.env.CLOUDINARY_API_SECRET = "dummysecretdummysecret";

const realFetch = globalThis.fetch;
type Route = (url: string) => Response;
let route: Route;
let seen: string[] = [];
beforeEach(() => {
  seen = [];
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    seen.push(url);
    return route(url);
  }) as any;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const ok = (body: string, type: string) => new Response(body, { status: 200, headers: { "content-type": type } });
const cldError = (status: number, reason: string) => new Response("", { status, headers: { "x-cld-error": reason } });
const pdf = { publicId: "Unnati Stores/scanned-bills/abc", format: "pdf", mimeType: "application/pdf", pages: 2 };
const jpg = { publicId: "Unnati Stores/scanned-bills/def", format: "jpg", mimeType: "image/jpeg" };

test("PDF original comes through the Admin download API (signed, expiring, resource_type image)", async () => {
  const { fetchForOcr } = await import("../../src/services/ocr/storage");
  route = () => ok("%PDF-1.4", "application/pdf");
  const files = await fetchForOcr(pdf);
  assert.equal(files.length, 1);
  assert.equal(files[0].mimeType, "application/pdf");
  const u = new URL(seen[0]);
  assert.equal(u.host, "api.cloudinary.com");
  assert.match(u.pathname, /\/demo-cloud\/image\/download$/);
  assert.equal(u.searchParams.get("type"), "authenticated");
  assert.equal(u.searchParams.get("format"), "pdf");
  assert.ok(Number(u.searchParams.get("expires_at")) > Date.now() / 1000);
  assert.match(u.searchParams.get("signature") || "", /^[0-9a-f]{40}$/);
});

test("JPG goes through the signed delivery URL (same signing as the preview)", async () => {
  const { fetchForOcr } = await import("../../src/services/ocr/storage");
  route = () => ok("jpegbytes", "image/jpeg");
  const files = await fetchForOcr(jpg);
  assert.equal(files[0].mimeType, "image/jpeg");
  assert.match(seen[0], /res\.cloudinary\.com\/demo-cloud\/image\/authenticated\/s--[^/]+--\//);
});

test("fetch failure says which step failed and Cloudinary's reason", async () => {
  const { fetchForOcr, StorageError } = await import("../../src/services/ocr/storage");
  route = () => cldError(401, "deny or ACL failure");
  await assert.rejects(fetchForOcr(jpg), (e: any) => e instanceof StorageError && e.step === "fetch" && e.status === 401 && e.message === "Couldn't download the bill from storage (401: deny or ACL failure).");
});

test("reason is cleaned: no 'String to sign' echo, no signatures", async () => {
  const { fetchForOcr } = await import("../../src/services/ocr/storage");
  route = () => cldError(401, "Invalid Signature 0000280ebb1cf6db4fbf2078ec6b09085797049d. String to sign - 'expires_at=1&public_id=x&timestamp=2'.");
  await assert.rejects(fetchForOcr(jpg), (e: any) => {
    assert.equal(e.message, "Couldn't download the bill from storage (401: Invalid Signature …).");
    return true;
  });
});

test("PDF download blocked → falls back to page renders (JPEG per page)", async () => {
  const { fetchForOcr } = await import("../../src/services/ocr/storage");
  route = (url) => (url.includes("api.cloudinary.com") ? cldError(401, "deny or ACL failure") : ok("jpegbytes", "image/jpeg"));
  const files = await fetchForOcr(pdf);
  assert.equal(files.length, 2);
  assert.ok(files.every((f) => f.mimeType === "image/jpeg"));
  assert.deepEqual(seen.slice(1).map((u) => u.match(/pg_(\d)/)?.[1]).sort(), ["1", "2"]);
  assert.ok(seen.slice(1).every((u) => new URL(u).pathname.endsWith(".jpg")));
});

test("PDF download and renders both fail → the PDF download error is reported", async () => {
  const { fetchForOcr } = await import("../../src/services/ocr/storage");
  route = (url) => (url.includes("api.cloudinary.com") ? cldError(404, "Resource not found - x") : cldError(500, "boom"));
  await assert.rejects(fetchForOcr(pdf), /Couldn't download the bill from storage \(404: Resource not found - x\)\./);
});

test("timeouts and missing keys name their step", async () => {
  const { fetchForOcr, StorageError } = await import("../../src/services/ocr/storage");
  route = () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); };
  await assert.rejects(fetchForOcr(jpg), (e: any) => e instanceof StorageError && e.step === "fetch" && /timed out/.test(e.message));
  const saved = process.env.CLOUDINARY_API_SECRET;
  process.env.CLOUDINARY_API_SECRET = "";
  try {
    await assert.rejects(fetchForOcr(jpg), (e: any) => e instanceof StorageError && e.step === "signing" && /Couldn't sign the storage link \(Cloudinary keys are not set on the server\)/.test(e.message));
  } finally {
    process.env.CLOUDINARY_API_SECRET = saved;
  }
});
