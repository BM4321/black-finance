import { describe, expect, it } from "vitest";

import {
  calculateSavingsRate,
  formatSavingsRate,
} from "@/lib/finance/health";

describe("calculateSavingsRate", () => {
  it("computes a normal positive rate", () => {
    // 1000 income, 600 expenses -> 40% saved
    expect(calculateSavingsRate("1000", "600")).toBeCloseTo(0.4);
  });

  it("returns a negative rate when overspending", () => {
    expect(calculateSavingsRate("1000", "1250")).toBeCloseTo(-0.25);
  });

  it("returns 1 when nothing was spent", () => {
    expect(calculateSavingsRate("5000", "0")).toBe(1);
  });

  it("returns null when there is no income (undefined rate)", () => {
    expect(calculateSavingsRate("0", "500")).toBeNull();
  });

  it("does not drift on values that break float math", () => {
    // 0.1 and 0.2 are the classic float traps.
    expect(calculateSavingsRate("0.30", "0.20")).toBeCloseTo(1 / 3, 10);
  });
});

describe("formatSavingsRate", () => {
  it("formats a ratio as a whole percentage", () => {
    expect(formatSavingsRate(0.4)).toBe("40%");
    expect(formatSavingsRate(-0.25)).toBe("-25%");
  });

  it("renders a placeholder for null", () => {
    expect(formatSavingsRate(null)).toBe("—");
  });
});
