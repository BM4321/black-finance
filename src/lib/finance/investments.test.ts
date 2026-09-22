import { describe, expect, it } from "vitest";

import {
  classifyGain,
  formatReturn,
  previewCostBasis,
  returnOnCost,
} from "@/lib/finance/investments";

describe("classifyGain", () => {
  it("classifies positive as gain", () => {
    expect(classifyGain("2000")).toBe("gain");
    expect(classifyGain("0.01")).toBe("gain");
  });

  it("classifies negative as loss", () => {
    expect(classifyGain("-1500")).toBe("loss");
  });

  it("classifies zero as flat", () => {
    expect(classifyGain("0")).toBe("flat");
    expect(classifyGain("0.00")).toBe("flat");
  });
});

describe("returnOnCost", () => {
  it("computes a positive return", () => {
    // 2000 gain on 10000 cost = 20%
    expect(returnOnCost("2000", "10000")).toBeCloseTo(0.2);
  });

  it("computes a negative return", () => {
    expect(returnOnCost("-2500", "10000")).toBeCloseTo(-0.25);
  });

  it("returns null when cost is zero", () => {
    expect(returnOnCost("500", "0")).toBeNull();
  });
});

describe("formatReturn", () => {
  it("formats a ratio as one-decimal percentage", () => {
    expect(formatReturn(0.2)).toBe("20.0%");
    expect(formatReturn(-0.1234)).toBe("-12.3%");
  });

  it("renders a placeholder for null", () => {
    expect(formatReturn(null)).toBe("—");
  });
});

describe("previewCostBasis", () => {
  it("multiplies whole quantities", () => {
    expect(previewCostBasis("10", "1000")).toBe("10000.00");
  });

  it("handles fractional quantities", () => {
    // 1.5 units at 1000 = 1500
    expect(previewCostBasis("1.5", "1000")).toBe("1500.00");
  });

  it("is exact across decimals", () => {
    expect(previewCostBasis("3", "0.10")).toBe("0.30");
  });

  it("returns zero for blank or partial input", () => {
    expect(previewCostBasis("", "1000")).toBe("0.00");
    expect(previewCostBasis("1.", "1000")).toBe("0.00");
    expect(previewCostBasis("1", "abc")).toBe("0.00");
  });
});
