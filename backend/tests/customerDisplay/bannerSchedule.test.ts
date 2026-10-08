import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bannerTargetsTerminal,
  getBannerStatus,
  getWindowStatus,
  isBannerLive,
  storeDayEnd,
  storeDayStart,
  toStoreDay,
  validateDayRange,
} from "../../src/modules/customerDisplay/bannerSchedule";
import { sanitizeDisplayState } from "../../src/modules/customerDisplay/displayState";

// 2026-10-07 12:00 IST
const NOW = new Date("2026-10-07T06:30:00.000Z");
const day = (d: string, edge: "start" | "end" = "start") => (edge === "start" ? storeDayStart(d) : storeDayEnd(d));

test("store days are whole days in IST", () => {
  assert.equal(storeDayStart("2026-10-07")!.toISOString(), "2026-10-06T18:30:00.000Z");
  assert.equal(storeDayEnd("2026-10-07")!.toISOString(), "2026-10-07T18:29:59.999Z");
  assert.equal(toStoreDay(new Date("2026-10-06T18:30:00.000Z")), "2026-10-07");
  assert.equal(toStoreDay(new Date("2026-10-06T18:29:59.999Z")), "2026-10-06");
  assert.equal(storeDayStart("2026-02-31"), null);
  assert.equal(storeDayStart("07-10-2026"), null);
});

test("active: today inside the range, inclusive of both end days", () => {
  assert.equal(getWindowStatus({ isActive: true, startDate: day("2026-10-01"), endDate: day("2026-10-07", "end") }, NOW), "active");
  assert.equal(getWindowStatus({ isActive: true, startDate: day("2026-10-07"), endDate: day("2026-10-07", "end") }, NOW), "active");
  // Last millisecond of the end day is still active
  assert.equal(
    getWindowStatus({ isActive: true, startDate: day("2026-10-01"), endDate: day("2026-10-07", "end") }, new Date("2026-10-07T18:29:59.999Z")),
    "active"
  );
  // No dates = always on
  assert.equal(getWindowStatus({ isActive: true }, NOW), "active");
});

test("scheduled: starts later", () => {
  assert.equal(getWindowStatus({ isActive: true, startDate: day("2026-10-08"), endDate: day("2026-10-14", "end") }, NOW), "scheduled");
  // Midnight boundary: the 8th starts at 18:30 UTC on the 7th
  assert.equal(getWindowStatus({ isActive: true, startDate: day("2026-10-08") }, new Date("2026-10-07T18:29:59.999Z")), "scheduled");
  assert.equal(getWindowStatus({ isActive: true, startDate: day("2026-10-08") }, new Date("2026-10-07T18:30:00.000Z")), "active");
});

test("expired: ended before today", () => {
  assert.equal(getWindowStatus({ isActive: true, startDate: day("2026-09-24"), endDate: day("2026-09-30", "end") }, NOW), "expired");
  assert.equal(getWindowStatus({ isActive: true, endDate: day("2026-10-06", "end") }, NOW), "expired");
});

test("inactive wins over dates", () => {
  assert.equal(getWindowStatus({ isActive: false, startDate: day("2026-10-01"), endDate: day("2026-10-30", "end") }, NOW), "inactive");
});

test("A/B/C for 7 days then D/E for the next 7 days", () => {
  const week1 = { isActive: true, startDate: day("2026-10-01"), endDate: day("2026-10-07", "end") };
  const week2 = { isActive: true, startDate: day("2026-10-08"), endDate: day("2026-10-14", "end") };
  const at = (iso: string) => new Date(iso);
  assert.deepEqual([getWindowStatus(week1, NOW), getWindowStatus(week2, NOW)], ["active", "scheduled"]);
  const nextWeek = at("2026-10-10T06:30:00.000Z");
  assert.deepEqual([getWindowStatus(week1, nextWeek), getWindowStatus(week2, nextWeek)], ["expired", "active"]);
});

test("campaign window limits its banners", () => {
  const banner = { isActive: true };
  assert.equal(getBannerStatus(banner, { isActive: true, startDate: day("2026-10-08") }, NOW), "scheduled");
  assert.equal(getBannerStatus(banner, { isActive: true, endDate: day("2026-10-06", "end") }, NOW), "expired");
  assert.equal(getBannerStatus(banner, { isActive: false }, NOW), "inactive");
  assert.equal(getBannerStatus(banner, { isActive: true, startDate: day("2026-10-01"), endDate: day("2026-10-31", "end") }, NOW), "active");
  // Banner's own window still applies inside an active campaign
  assert.equal(getBannerStatus({ isActive: true, startDate: day("2026-10-20") }, { isActive: true }, NOW), "scheduled");
  assert.equal(getBannerStatus({ isActive: true }, null, NOW), "active");
});

test("terminal targeting: empty list = all terminals", () => {
  assert.equal(bannerTargetsTerminal({ isActive: true, terminals: [] }, "3"), true);
  assert.equal(bannerTargetsTerminal({ isActive: true, terminals: ["1", "2"] }, "2"), true);
  assert.equal(bannerTargetsTerminal({ isActive: true, terminals: ["1", "2"] }, "3"), false);
  assert.equal(bannerTargetsTerminal({ isActive: true, terminals: ["1"] }, null), false);
  assert.equal(isBannerLive({ isActive: true, terminals: ["1"] }, null, "1", NOW), true);
  assert.equal(isBannerLive({ isActive: true, terminals: ["1"], startDate: day("2026-10-09") }, null, "1", NOW), false);
});

test("date range validation", () => {
  assert.equal(validateDayRange("2026-10-01", "2026-10-07"), null);
  assert.equal(validateDayRange("2026-10-07", "2026-10-07"), null);
  assert.equal(validateDayRange(null, null), null);
  assert.match(validateDayRange("2026-10-08", "2026-10-07")!, /on or after/);
  assert.match(validateDayRange("2026-13-01", null)!, /not a valid/);
});

test("display state keeps only whitelisted bill fields", () => {
  const clean = sanitizeDisplayState({
    seq: 5,
    phase: "billing",
    billNo: "B-1",
    items: [{ id: "a", name: "Milk", qty: 2, unitPrice: 30, mrp: 32, lineTotal: 60, purchasePrice: 21, sellerId: "x" }],
    totals: { itemCount: 2, subtotal: 64, discount: 4, tax: 2.86, grandTotal: 60 },
    payment: { method: "UPI", amount: 60 },
    customer: { phone: "9999999999" },
  })!;
  assert.deepEqual(Object.keys(clean.items[0]).sort(), ["id", "lineTotal", "mrp", "name", "qty", "unitPrice"]);
  assert.equal((clean as any).customer, undefined);
  assert.equal(clean.payment, null, "payment info is dropped outside payment/paid phases");
  assert.equal(sanitizeDisplayState({ phase: "billing" }), null, "seq is required");
  assert.equal(sanitizeDisplayState({ seq: 1, phase: "hacked" })!.phase, "idle");
});

test("customer screen gets the saved customer's name only, never phone or address", () => {
  const clean = sanitizeDisplayState({
    seq: 9,
    phase: "billing",
    customerName: "Rahul Sharma",
    customerPhone: "9876543210",
    customerAddress: "12 MG Road",
    customerGst: "29ABCDE1234F1Z5",
    creditBalance: 1500,
    items: [],
  })! as any;
  assert.equal(clean.customerName, "Rahul Sharma");
  for (const leaked of ["customerPhone", "customerAddress", "customerGst", "creditBalance"]) {
    assert.equal(clean[leaked], undefined, `${leaked} must not reach the customer screen`);
  }
  assert.equal(sanitizeDisplayState({ seq: 1 })!.customerName, "", "walk-ins have no name");
});
