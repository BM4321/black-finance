import { describe, expect, it } from "vitest";

import { currentMonth, resolvePeriod } from "@/lib/ai/retrieval/period";

// A fixed "now" so period tests are deterministic: 15 September 2026.
const NOW = new Date(Date.UTC(2026, 8, 15));

describe("currentMonth", () => {
  it("covers the first to the last day of the month", () => {
    expect(currentMonth(NOW)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      label: "this month (September 2026)",
    });
  });

  it("handles February in a leap year", () => {
    const feb = currentMonth(new Date(Date.UTC(2028, 1, 10)));
    expect(feb.to).toBe("2028-02-29");
  });
});

describe("resolvePeriod", () => {
  it("defaults to this month when no time phrase is present", () => {
    expect(resolvePeriod("give me a summary", NOW).from).toBe("2026-09-01");
  });

  it("resolves 'last month'", () => {
    expect(resolvePeriod("how much did I spend last month?", NOW)).toMatchObject({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("resolves a named month in the current year", () => {
    expect(resolvePeriod("spending in March", NOW).from).toBe("2026-03-01");
  });

  it("resolves a named month from the previous year when it is in the future", () => {
    // December is after September, so it must mean December 2025.
    expect(resolvePeriod("what about December?", NOW).from).toBe("2025-12-01");
  });

  it("resolves 'last N days'", () => {
    const period = resolvePeriod("spending in the last 30 days", NOW);
    expect(period.from).toBe("2026-08-17");
    expect(period.to).toBe("2026-09-15");
  });

  it("resolves 'this week' from Monday", () => {
    // 15 Sep 2026 is a Tuesday, so the week starts Monday 14 Sep.
    expect(resolvePeriod("this week", NOW).from).toBe("2026-09-14");
  });

  it("resolves 'last year'", () => {
    expect(resolvePeriod("how did last year go?", NOW)).toMatchObject({
      from: "2025-01-01",
      to: "2025-12-31",
    });
  });

  it("prefers 'last month' over a bare month name in a combined phrase", () => {
    // "last month" is more specific than the incidental word "March".
    expect(resolvePeriod("compare March with last month", NOW).from).toBe(
      "2026-08-01",
    );
  });
});
