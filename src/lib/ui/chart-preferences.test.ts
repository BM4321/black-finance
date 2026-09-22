import { describe, expect, it } from "vitest";

import {
  chartPreferenceKey,
  DEFAULT_INCOME_CHART,
  INCOME_CHART_TYPES,
  resolveChartType,
} from "@/lib/ui/chart-preferences";

describe("resolveChartType", () => {
  it("returns a valid stored value", () => {
    expect(resolveChartType("line", INCOME_CHART_TYPES, DEFAULT_INCOME_CHART)).toBe(
      "line",
    );
  });

  it("falls back when the value is absent", () => {
    expect(resolveChartType(null, INCOME_CHART_TYPES, DEFAULT_INCOME_CHART)).toBe(
      "bar",
    );
    expect(
      resolveChartType(undefined, INCOME_CHART_TYPES, DEFAULT_INCOME_CHART),
    ).toBe("bar");
  });

  it("falls back when the value is not an allowed option", () => {
    expect(
      resolveChartType("donut", INCOME_CHART_TYPES, DEFAULT_INCOME_CHART),
    ).toBe("bar");
  });

  it("falls back on an empty string", () => {
    expect(resolveChartType("", INCOME_CHART_TYPES, DEFAULT_INCOME_CHART)).toBe(
      "bar",
    );
  });
});

describe("chartPreferenceKey", () => {
  it("namespaces the key", () => {
    expect(chartPreferenceKey("income")).toBe("bf_chart_income");
  });
});
