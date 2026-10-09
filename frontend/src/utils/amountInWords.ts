/**
 * Same logic as backend/src/services/ocr/amountInWords.ts (keep the two in step).
 *
 * Amount in words, Indian style ("Rupees Twelve Thousand Three Hundred Forty Five and Fifty
 * Paise Only"). Two directions:
 *  - parseAmountInWords: words printed on a bill → number, to cross-check the grand total
 *  - amountToIndianWords: number → words
 */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1_000,
  lakh: 100_000, lakhs: 100_000, lac: 100_000, lacs: 100_000,
  million: 1_000_000,
  crore: 10_000_000, crores: 10_000_000,
  billion: 1_000_000_000,
};

/** Words for a whole number (e.g. "twelve thousand three hundred"); null if any word is unknown. */
function wordsToInt(words: string[]): number | null {
  if (!words.length) return null;
  let total = 0;
  let current = 0;
  let sawNumber = false;
  for (const w of words) {
    if (w in UNITS) {
      current += UNITS[w];
      sawNumber = true;
    } else if (w === "hundred") {
      current = (current || 1) * 100;
      sawNumber = true;
    } else if (w in SCALES) {
      total += (current || 1) * SCALES[w];
      current = 0;
      sawNumber = true;
    } else if (/^\d+$/.test(w)) {
      current += Number(w);
      sawNumber = true;
    } else {
      return null;
    }
  }
  return sawNumber ? total + current : null;
}

const FILLER = new Set(["rupees", "rupee", "rs", "inr", "only", "and", "indian", "the", "sum", "of", "amount", "total", "a"]);

/**
 * "Rupees One Lakh Twenty Thousand and Fifty Paise Only" → 120000.5
 * Returns null when the text can't be read as an amount (so the caller just skips the check).
 */
export function parseAmountInWords(input?: string | null): number | null {
  if (!input) return null;
  const text = String(input)
    .toLowerCase()
    .replace(/₹/g, " rupees ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  // Split rupees and paise: "... and fifty paise" / "... paise fifty"
  let rupeePart = text;
  let paisePart = "";
  const paiseIdx = text.search(/\b(paise|paisa|paisas)\b/);
  if (paiseIdx !== -1) {
    const before = text.slice(0, paiseIdx).trim();
    const after = text.slice(paiseIdx).replace(/^(paise|paisa|paisas)\b/, "").trim();
    // "and fifty paise": the paise words are the ones after the last "and"
    const andIdx = before.lastIndexOf(" and ");
    if (andIdx !== -1) {
      rupeePart = before.slice(0, andIdx);
      paisePart = before.slice(andIdx + 5);
    } else if (after && !/^only\b/.test(after)) {
      rupeePart = before;
      paisePart = after;
    } else {
      rupeePart = "";
      paisePart = before;
    }
  }

  const clean = (s: string) => s.split(" ").filter((w) => w && !FILLER.has(w));
  const rupeeWords = clean(rupeePart);
  const paiseWords = clean(paisePart);

  const rupees = rupeeWords.length ? wordsToInt(rupeeWords) : 0;
  const paise = paiseWords.length ? wordsToInt(paiseWords) : 0;
  if (rupees === null || paise === null) return null;
  if (!rupeeWords.length && !paiseWords.length) return null;
  if (paise >= 100) return null;
  return Math.round((rupees + paise / 100) * 100) / 100;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

function intToIndianWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1_000);
  n %= 1_000;
  if (crore) parts.push(`${crore >= 1000 ? intToIndianWords(crore) : below1000(crore)} Crore`);
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}

/** 12345.5 → "Rupees Twelve Thousand Three Hundred Forty Five and Fifty Paise Only" */
export function amountToIndianWords(amount: number): string {
  const value = Math.round(Math.abs(Number(amount) || 0) * 100);
  const rupees = Math.floor(value / 100);
  const paise = value % 100;
  let words = `Rupees ${intToIndianWords(rupees)}`;
  if (paise) words += ` and ${below1000(paise)} Paise`;
  return `${words} Only`;
}
