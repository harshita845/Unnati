import { test, before } from "node:test";
import assert from "node:assert/strict";

// The Cloudinary config reads the real credentials from .env the moment it is imported (dotenv never
// overrides a variable that is already set, even to ""). Blank them first, or the failure test below
// would upload a picture to the real account. Everything is imported only after this has run.
for (const name of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_URL"]) {
  process.env[name] = "";
}

let offloadInlineImages: typeof import("../../src/services/inlineImageService").offloadInlineImages;
let isInlineImage: typeof import("../../src/services/inlineImageService").isInlineImage;
let InlineImageUploadError: typeof import("../../src/services/inlineImageService").InlineImageUploadError;

before(async () => {
  ({ offloadInlineImages, isInlineImage, InlineImageUploadError } = await import("../../src/services/inlineImageService"));
  assert.equal(process.env.CLOUDINARY_CLOUD_NAME, "", "these tests must never run with real Cloudinary credentials");
});

/**
 * A picture saved as text inside a seller record ballooned the home page to 600 KB. These cover the
 * decision that matters: links pass through untouched, text pictures are detected, and when the
 * upload cannot happen the save is refused rather than quietly storing the text.
 */

test("only data-URL pictures are treated as inline", () => {
  assert.equal(isInlineImage("data:image/jpeg;base64,/9j/4AAQ"), true);
  assert.equal(isInlineImage("data:image/png;base64,iVBOR"), true);
  assert.equal(isInlineImage("https://res.cloudinary.com/x/image/upload/a.jpg"), false);
  assert.equal(isInlineImage(""), false);
  assert.equal(isInlineImage(undefined), false);
  assert.equal(isInlineImage(null), false);
  assert.equal(isInlineImage("data:application/pdf;base64,JVBER"), false);
});

test("links and empty values pass through untouched, with no upload attempted", async () => {
  const input = {
    logo: "https://res.cloudinary.com/x/image/upload/logo.jpg",
    storeBanner: "",
    profile: undefined as string | undefined,
    storeName: "Unnati Indore Store 1",
  };
  const before = JSON.stringify(input);
  const out = await offloadInlineImages(input);
  assert.equal(JSON.stringify(out), before, "nothing should change when there is no inline picture");
});

test("fields that are not pictures are never touched, even if they look like data", async () => {
  const input: Record<string, any> = { address: "data:image/png;base64,AAAA", logo: "https://x/y.jpg" };
  await offloadInlineImages(input);
  assert.equal(input.address, "data:image/png;base64,AAAA", "only the listed picture fields are converted");
});

test("an upload that cannot happen refuses the save instead of storing the text", async () => {
  // the credentials were blanked above, so the upload fails on the spot and never leaves this machine
  const input = { logo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" };
  await assert.rejects(offloadInlineImages(input), (error: unknown) => {
    assert.ok(error instanceof InlineImageUploadError, "must be reported as an upload error the route can turn into a 502");
    assert.equal((error as InlineImageUploadError).field, "logo");
    assert.match((error as Error).message, /logo/);
    return true;
  });
  assert.ok(input.logo.startsWith("data:image/"), "the original value must be left as it was on failure");
});
