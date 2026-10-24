/**
 * Reads the quantity written in a pack label, such as "50 kg", "500 g", "1 Ltr" or "90 m Coil", so a
 * repack can suggest how much bulk stock one pack uses: a 1 kg pack takes 1/50 of a 50 kg bag.
 * Everything is converted to a base unit per dimension (grams, millilitres, millimetres, pieces),
 * and only same-dimension labels are compared. Labels without a recognisable quantity return null,
 * and the person repacking enters the ratio by hand (one box holds 100 bolts, and so on).
 */

export type PackDimension = "mass" | "volume" | "length" | "count";

export interface PackQuantity {
  amount: number;
  unit: string;
  dimension: PackDimension;
  /** amount expressed in the dimension's base unit (g, ml, mm or pieces) */
  base: number;
}

const UNITS: Record<string, { dimension: PackDimension; factor: number }> = {
  mg: { dimension: "mass", factor: 0.001 },
  g: { dimension: "mass", factor: 1 }, gm: { dimension: "mass", factor: 1 }, gms: { dimension: "mass", factor: 1 },
  gram: { dimension: "mass", factor: 1 }, grams: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1000 }, kgs: { dimension: "mass", factor: 1000 },
  kilo: { dimension: "mass", factor: 1000 }, kilos: { dimension: "mass", factor: 1000 },
  kilogram: { dimension: "mass", factor: 1000 }, kilograms: { dimension: "mass", factor: 1000 },
  quintal: { dimension: "mass", factor: 100000 }, quintals: { dimension: "mass", factor: 100000 }, qtl: { dimension: "mass", factor: 100000 },
  ton: { dimension: "mass", factor: 1000000 }, tons: { dimension: "mass", factor: 1000000 },
  tonne: { dimension: "mass", factor: 1000000 }, tonnes: { dimension: "mass", factor: 1000000 },
  ml: { dimension: "volume", factor: 1 }, millilitre: { dimension: "volume", factor: 1 }, milliliter: { dimension: "volume", factor: 1 },
  l: { dimension: "volume", factor: 1000 }, ltr: { dimension: "volume", factor: 1000 }, ltrs: { dimension: "volume", factor: 1000 },
  litre: { dimension: "volume", factor: 1000 }, litres: { dimension: "volume", factor: 1000 },
  liter: { dimension: "volume", factor: 1000 }, liters: { dimension: "volume", factor: 1000 },
  mm: { dimension: "length", factor: 1 }, cm: { dimension: "length", factor: 10 },
  m: { dimension: "length", factor: 1000 }, mtr: { dimension: "length", factor: 1000 }, mtrs: { dimension: "length", factor: 1000 },
  metre: { dimension: "length", factor: 1000 }, metres: { dimension: "length", factor: 1000 },
  meter: { dimension: "length", factor: 1000 }, meters: { dimension: "length", factor: 1000 },
  ft: { dimension: "length", factor: 304.8 }, feet: { dimension: "length", factor: 304.8 },
  pc: { dimension: "count", factor: 1 }, pcs: { dimension: "count", factor: 1 }, piece: { dimension: "count", factor: 1 },
  pieces: { dimension: "count", factor: 1 }, nos: { dimension: "count", factor: 1 }, unit: { dimension: "count", factor: 1 },
  units: { dimension: "count", factor: 1 }, dozen: { dimension: "count", factor: 12 },
};

export const parsePackQuantity = (label?: string | null): PackQuantity | null => {
  if (!label) return null;
  const re = /(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/g;
  for (const match of String(label).matchAll(re)) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const def = UNITS[unit];
    if (def && amount > 0) return { amount, unit, dimension: def.dimension, base: amount * def.factor };
  }
  return null;
};

/** How many of the source item one target pack uses, judging by their labels; null if they can't be compared. */
export const suggestSourcePerPack = (sourceLabel?: string | null, targetLabel?: string | null): number | null => {
  const source = parsePackQuantity(sourceLabel);
  const target = parsePackQuantity(targetLabel);
  if (!source || !target || source.dimension !== target.dimension) return null;
  return Math.round((target.base / source.base) * 1e6) / 1e6;
};
