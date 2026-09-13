import { describe, expect, it } from "vitest";

import {
  formatMoney,
  fromMinorUnits,
  sumAmounts,
  toMinorUnits,
} from "@/lib/finance/money";

describe("toMinorUnits / fromMinorUnits", () => {
  it("round-trips decimal strings for a 2-decimal currency", () => {
    expect(fromMinorUnits(toMinorUnits("1234.56"))).toBe("1234.56");
    expect(fromMinorUnits(toMinorUnits("0.01"))).toBe("0.01");
    expect(fromMinorUnits(toMinorUnits("0"))).toBe("0.00");
  });

  it("preserves sign", () => {
    expect(toMinorUnits("-50.25")).toBe(-5025);
    expect(fromMinorUnits(-5025)).toBe("-50.25");
  });

  it("handles whole-number currencies without decimals", () => {
    expect(fromMinorUnits(toMinorUnits("5000", "UGX"), "UGX")).toBe("5000");
    expect(fromMinorUnits(5000, "UGX")).toBe("5000");
  });

  it("rounds sub-minor-unit input to the nearest minor unit", () => {
    expect(toMinorUnits("1.005")).toBe(101);
    expect(toMinorUnits("1.004")).toBe(100);
  });

  it("rejects non-finite input instead of producing NaN", () => {
    expect(() => toMinorUnits("abc")).toThrow(TypeError);
    expect(() => toMinorUnits(Number.NaN)).toThrow(TypeError);
    expect(() => toMinorUnits(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it("rejects non-integer minor units on the way out", () => {
    expect(() => fromMinorUnits(10.5)).toThrow(TypeError);
  });
});

describe("sumAmounts (float-safety)", () => {
  it("sums exactly where naive float addition drifts", () => {
    // 0.1 + 0.2 === 0.30000000000000004 with JS numbers.
    expect(sumAmounts(["0.1", "0.2"])).toBe("0.30");
  });

  it("sums many small amounts without accumulated error", () => {
    const amounts = Array.from({ length: 1000 }, () => "0.01");
    expect(sumAmounts(amounts)).toBe("10.00");
  });

  it("handles mixed positive and negative amounts (income vs expense)", () => {
    expect(sumAmounts(["1000.00", "-250.50", "-100.00"])).toBe("649.50");
  });

  it("returns zero for an empty set", () => {
    expect(sumAmounts([])).toBe("0.00");
  });
});

describe("formatMoney", () => {
  it("formats with the correct number of decimals", () => {
    expect(formatMoney("1000", "TZS")).toContain("1,000.00");
    expect(formatMoney("5000", "UGX")).toContain("5,000");
  });

  it("renders a placeholder for invalid values", () => {
    expect(formatMoney("not-a-number")).toBe("—");
  });
});
