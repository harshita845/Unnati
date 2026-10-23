import type { Schema } from "mongoose";
import type { notifyContentUpdated } from "./socketService";
import { cache, invalidateCategoryCache } from "../utils/cache";

type ContentType = Parameters<typeof notifyContentUpdated>[0];

/**
 * Resolved on first use, not at import time: socketService loads models, and a model that loaded
 * socketService while still initialising would close the import cycle and crash the server on boot.
 */
const getNotifier = (): typeof notifyContentUpdated | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./socketService") as typeof import("./socketService")).notifyContentUpdated;
  } catch (error) {
    console.error("Content broadcast unavailable:", (error as Error).message);
    return null;
  }
};

/**
 * Admin edits a category image, the customer app keeps showing the old one until someone reloads
 * the page. The browser is already listening for these events and clearing its cache; nothing was
 * sending them, because every controller had to remember to, and most did not.
 *
 * So the models announce their own changes. A write through any route — admin, seller, a bulk
 * import, a one-off script — reaches the customer app, and a new controller cannot forget to.
 */

/**
 * Telling the app to refetch is useless while the server still answers from its own cache: the
 * category payloads carry the products inside them, so a changed product photo stayed hidden
 * behind a 10-minute entry no matter how many times the customer reloaded.
 */
const clearServerCache = (type: ContentType) => {
  // Categories and products are served inside each other's payloads — a category response carries
  // its product list, a search result carries both — so either changing invalidates both.
  if (type === "categories" || type === "products") {
    invalidateCategoryCache();
    cache.invalidatePattern(/^search:/);
  }
  if (type === "promo" || type === "home" || type === "deals" || type === "banners") {
    cache.invalidatePattern(/^promoStrip-/);
  }
};

// A bulk import writing 2,000 products should wake the app once, not 2,000 times
const PENDING_WINDOW_MS = 300;
const pending = new Map<ContentType, NodeJS.Timeout>();

export const broadcastContentChange = (type: ContentType) => {
  // Dropping stale entries is cheap and must happen on every write: a read arriving in the next
  // millisecond has to see the new data. Only the socket announcement is worth coalescing.
  clearServerCache(type);

  if (pending.has(type)) return;
  const timer = setTimeout(() => {
    pending.delete(type);
    try {
      getNotifier()?.(type);
    } catch (error) {
      // A failed announcement must never fail the write that triggered it
      console.error(`Could not announce ${type} change:`, (error as Error).message);
    }
  }, PENDING_WINDOW_MS);
  timer.unref?.(); // never hold the process open just to send one of these
  pending.set(type, timer);
};

/** Every mongoose path that can change a document, so no write slips through unannounced. */
const WRITE_HOOKS = [
  "save",
  "insertMany",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
] as const;

export const announceChangesOn = (schema: Schema, type: ContentType) => {
  for (const hook of WRITE_HOOKS) {
    // `as any`: mongoose types each hook name separately, but the callback shape is the same
    schema.post(hook as any, function () {
      broadcastContentChange(type);
    });
  }
};
