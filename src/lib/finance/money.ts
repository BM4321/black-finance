/**
 * Exact monetary representation.
 *
 * Problem: JavaScript numbers are IEEE-754 floats. `0.1 + 0.2 !== 0.3`, and
 * summing thousands of transaction amounts accumulates visible cent-level
 * drift. PostgreSQL stores our amounts as NUMERIC, but the moment we add them
 * up in JS we risk reintroducing that error.
 *
 * Strategy: represent money internally as integer minor units (e.g. cents,
 * or for TZS the smallest practical unit). Integer arithmetic is exact for
 * every value we will realistically handle, and we convert to a decimal string
 * only at the boundary (display, or writing back to a NUMERIC column).
 */

/** Number of minor units per major unit, keyed by ISO 4217 code we support. */
const MINOR_UNITS: Record<string, number> = {
  TZS: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  KES: 2,
  UGX: 0,
  JPY: 0,
};

const DEFAULT_MINOR_UNITS = 2;

/** Number of decimal places for a currency (e.g. 2 for TZS, 0 for UGX). */
function decimalsFor(currency: string): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? DEFAULT_MINOR_UNITS;
}

/** Multiplier that converts major units to minor units. */
function scaleFor(currency: string): number {
  return 10 ** decimalsFor(currency);
}

/**
 * Convert a decimal amount (string from Postgres, or number from a form) into
 * integer minor units. Accepts a currency to know the exponent.
 *
 * Parsing is done digit-by-digit on the decimal string rather than multiplying
 * a float by a scale. `1.005 * 100` is `100.49999999999999` in IEEE-754, which
 * would silently round the wrong way; exact string parsing avoids that class of
 * bug entirely.
 *
 * Throws on malformed input so corrupt data fails loudly rather than silently
 * becoming NaN in a balance.
 */
export function toMinorUnits(
  amount: string | number,
  currency = "TZS",
): number {
  const raw =
    typeof amount === "number"
      ? Number.isFinite(amount)
        ? amount.toString()
        : null
      : amount.trim();
  const match = raw?.match(/^([+-]?)(\d*)(?:\.(\d*))?$/);
  if (!match) {
    throw new TypeError(`Cannot convert amount to minor units: ${amount}`);
  }

  const [, signToken, whole = "", fraction = ""] = match;
  if (whole === "" && fraction === "") {
    throw new TypeError(`Cannot convert amount to minor units: ${amount}`);
  }

  const decimals = decimalsFor(currency);
  // Pad the fraction to the target precision, or round the first dropped digit.
  const kept = fraction.slice(0, decimals).padEnd(decimals, "0");
  const dropped = fraction.slice(decimals);
  let minor = Number(whole || "0") * 10 ** decimals + Number(kept || "0");
  if (dropped.length > 0 && Number(dropped[0]) >= 5) {
    minor += 1; // round half away from zero at the target precision
  }

  return signToken === "-" ? -minor : minor;
}

/** Convert integer minor units back to a fixed-scale decimal string. */
export function fromMinorUnits(minor: number, currency = "TZS"): string {
  if (!Number.isInteger(minor)) {
    throw new TypeError(`Minor units must be an integer, got ${minor}`);
  }
  const scale = scaleFor(currency);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const major = Math.floor(abs / scale);
  const fraction = abs % scale;
  if (scale === 1) return `${sign}${major}`;
  const width = String(scale).length - 1;
  return `${sign}${major}.${String(fraction).padStart(width, "0")}`;
}

/**
 * Sum decimal amounts exactly by summing in minor units.
 * This is the primitive every balance/report calculation should use.
 */
export function sumAmounts(
  amounts: Array<string | number>,
  currency = "TZS",
): string {
  const totalMinor = amounts.reduce<number>(
    (acc, amount) => acc + toMinorUnits(amount, currency),
    0,
  );
  return fromMinorUnits(totalMinor, currency);
}

/** Format a decimal amount for display, with thousands separators. */
export function formatMoney(amount: string | number, currency = "TZS"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  const decimals = decimalsFor(currency);
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
