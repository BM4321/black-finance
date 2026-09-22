/**
 * Investment helpers.
 *
 * Pure and deterministic. `investment_holdings` in the database already derives
 * cost basis, market value and gain; these helpers handle presentation concerns
 * (formatting a percentage, classifying a gain) and the arithmetic for the
 * live form preview, kept in integer minor units so it stays exact.
 */

import { fromMinorUnits, toMinorUnits } from "@/lib/finance/money";

export type GainKind = "gain" | "loss" | "flat";

/** Classify a gain/loss amount (decimal string) for colouring and labels. */
export function classifyGain(gain: string | number): GainKind {
  const minor = toMinorUnits(gain);
  if (minor > 0) return "gain";
  if (minor < 0) return "loss";
  return "flat";
}

/**
 * Return on cost as a ratio: gain / cost.
 *
 * Returns null when cost is zero (a free acquisition): a return against zero is
 * undefined, so the UI shows a neutral state rather than a misleading 0%.
 */
export function returnOnCost(
  gain: string | number,
  costBasis: string | number,
): number | null {
  const cost = toMinorUnits(costBasis);
  if (cost === 0) return null;
  return toMinorUnits(gain) / cost;
}

/** Format a return ratio as a percentage, or "—" when undefined. */
export function formatReturn(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Cost basis for the live form preview: quantity * purchase price.
 *
 * Quantity may be fractional, so this multiplies in minor units carefully:
 * `price` is converted to minor units and scaled by the fractional quantity,
 * then rounded to the nearest minor unit.
 */
export function previewCostBasis(
  quantity: string,
  purchasePrice: string,
): string {
  const quantityText = quantity.trim();
  const priceText = purchasePrice.trim();
  if (!/^\d+(\.\d+)?$/.test(quantityText) || !/^\d+(\.\d+)?$/.test(priceText)) {
    return "0.00";
  }
  const totalMinor = Math.round(
    toMinorUnits(priceText) * Number(quantityText),
  );
  return fromMinorUnits(totalMinor);
}
