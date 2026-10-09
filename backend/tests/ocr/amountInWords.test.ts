import { test } from "node:test";
import assert from "node:assert/strict";
import { amountToIndianWords, parseAmountInWords } from "../../src/services/ocr/amountInWords";

test("parses Indian amount-in-words", () => {
  assert.equal(parseAmountInWords("Rupees Four Thousand Seven Hundred Only"), 4700);
  assert.equal(parseAmountInWords("Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only"), 123456.78);
  assert.equal(parseAmountInWords("INR Two Crore Five Lakh Only"), 20500000);
  assert.equal(parseAmountInWords("Rs. Ninety-Nine only"), 99);
  assert.equal(parseAmountInWords("Fifty Paise Only"), 0.5);
  assert.equal(parseAmountInWords("Rupees One Hundred Thousand Only"), 100000);
  assert.equal(parseAmountInWords("₹ Twelve Lacs"), 1200000);
});

test("unreadable words return null (check is skipped)", () => {
  assert.equal(parseAmountInWords(""), null);
  assert.equal(parseAmountInWords(null), null);
  assert.equal(parseAmountInWords("Rupees Fourtyy Thousnd"), null);
  assert.equal(parseAmountInWords("Only"), null);
});

test("formats amounts in Indian words", () => {
  assert.equal(amountToIndianWords(4700), "Rupees Four Thousand Seven Hundred Only");
  assert.equal(amountToIndianWords(123456.78), "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only");
  assert.equal(amountToIndianWords(0), "Rupees Zero Only");
  assert.equal(amountToIndianWords(10000000), "Rupees One Crore Only");
});

test("format → parse round-trips", () => {
  for (const n of [1, 19, 101, 999.99, 1000, 54321.05, 9876543.21, 120000000]) {
    assert.equal(parseAmountInWords(amountToIndianWords(n)), n, String(n));
  }
});
