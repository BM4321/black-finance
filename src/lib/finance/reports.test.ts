import { describe, expect, it } from "vitest";

import {
  changeRatio,
  formatChange,
  savingsRateSeries,
  shareOfTotal,
} from "@/lib/finance/reports";

describe("savingsRateSeries", () => {
  it("computes a rate per month", () => {
    const series = savingsRateSeries([
      { monthStart: "2026-01", income: "1000", expense: "600", savings: "400" },
    ]);
    expect(series[0].rate).toBeCloseTo(0.4);
  });

  it("is null for a month with no income", () => {
    const series = savingsRateSeries([
      { monthStart: "2026-01", income: "0", expense: "100", savings: "-100" },
    ]);
    expect(series[0].rate).toBeNull();
  });

  it("preserves order and month labels", () => {
    const series = savingsRateSeries([
      { monthStart: "2026-01", income: "100", expense: "50", savings: "50" },
      { monthStart: "2026-02", income: "200", expense: "50", savings: "150" },
    ]);
    expect(series.map((s) => s.monthStart)).toEqual(["2026-01", "2026-02"]);
  });
});

describe("shareOfTotal", () => {
  it("computes a fraction", () => {
    expect(shareOfTotal("250", "1000")).toBeCloseTo(0.25);
  });

  it("is null when the total is zero", () => {
    expect(shareOfTotal("10", "0")).toBeNull();
  });

  it("can exceed one (defensive)", () => {
    expect(shareOfTotal("1500", "1000")).toBeCloseTo(1.5);
  });
});

describe("changeRatio", () => {
  it("computes an increase", () => {
    expect(changeRatio("150", "100")).toBeCloseTo(0.5);
  });

  it("computes a decrease", () => {
    expect(changeRatio("75", "100")).toBeCloseTo(-0.25);
  });

  it("is null when the previous value is zero", () => {
    expect(changeRatio("100", "0")).toBeNull();
  });
});

describe("formatChange", () => {
  it("signs positive changes", () => {
    expect(formatChange(0.5)).toBe("+50.0%");
  });

  it("leaves negative changes signed by the value", () => {
    expect(formatChange(-0.25)).toBe("-25.0%");
  });

  it("renders a placeholder for null", () => {
    expect(formatChange(null)).toBe("—");
  });
});
