import { describe, expect, it } from "vitest";

import {
  addMonths,
  calendarPeriod,
  customPeriodError,
  daysBetween,
  defaultCustomEnd,
  formatPeriod,
  periodContains,
} from "@/lib/finance/budget-periods";

describe("addMonths", () => {
  it("moves to the same day next month", () => {
    expect(addMonths("2026-09-25", 1)).toBe("2026-10-25");
  });

  it("clamps to the end of a shorter month, like PostgreSQL", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("crosses year boundaries", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
});

describe("calendarPeriod", () => {
  it("covers the whole month, whatever day is given", () => {
    expect(calendarPeriod("2026-02-17")).toEqual({
      type: "calendar",
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(calendarPeriod("2026-09-01").end).toBe("2026-09-30");
  });
});

describe("defaultCustomEnd", () => {
  it("ends the day before the same date next month", () => {
    expect(defaultCustomEnd("2026-09-25")).toBe("2026-10-24");
    expect(defaultCustomEnd("2026-12-28")).toBe("2027-01-27");
  });
});

describe("customPeriodError", () => {
  it("accepts a payday-to-payday period", () => {
    expect(customPeriodError("2026-09-01", "2026-09-25", "2026-10-24")).toBeNull();
  });

  it("lets the period start in the previous month (24 Sep – 25 Oct for October)", () => {
    expect(customPeriodError("2026-10-01", "2026-09-24", "2026-10-25")).toBeNull();
    expect(customPeriodError("2026-09-01", "2026-08-24", "2026-09-23")).toBeNull();
  });

  it("requires at least one day of the budget's month", () => {
    expect(customPeriodError("2026-12-01", "2026-11-01", "2026-11-20")).toMatch(
      /December 2026/,
    );
    expect(customPeriodError("2026-09-01", "2026-10-01", "2026-10-20")).toMatch(
      /September 2026/,
    );
  });

  it("accepts a period touching its month by a single day", () => {
    expect(customPeriodError("2026-10-01", "2026-09-02", "2026-10-01")).toBeNull();
  });

  it("rejects an end before the start", () => {
    expect(customPeriodError("2026-09-01", "2026-09-25", "2026-09-20")).toMatch(/before/);
  });

  it("allows a single-day period", () => {
    expect(customPeriodError("2026-09-01", "2026-09-25", "2026-09-25")).toBeNull();
  });

  it("rejects periods longer than about two months", () => {
    expect(daysBetween("2026-09-01", "2026-11-02")).toBe(62);
    expect(customPeriodError("2026-09-01", "2026-09-01", "2026-11-02")).toBeNull();
    expect(customPeriodError("2026-09-01", "2026-09-01", "2026-11-03")).toMatch(/two months/);
  });

  it("rejects missing dates", () => {
    expect(customPeriodError("2026-09-01", "", "2026-10-24")).toMatch(/start/);
    expect(customPeriodError("2026-09-01", "2026-09-25", "")).toMatch(/end/);
  });
});

describe("periodContains", () => {
  const period = { type: "custom" as const, start: "2026-09-25", end: "2026-10-24" };

  it("includes both ends", () => {
    expect(periodContains(period, "2026-09-25")).toBe(true);
    expect(periodContains(period, "2026-10-24")).toBe(true);
  });

  it("excludes days outside", () => {
    expect(periodContains(period, "2026-09-24")).toBe(false);
    expect(periodContains(period, "2026-10-25")).toBe(false);
  });
});

describe("formatPeriod", () => {
  it("shows the year once when both ends share it", () => {
    expect(formatPeriod({ start: "2026-09-25", end: "2026-10-24" })).toBe(
      "25 Sep – 24 Oct 2026",
    );
  });

  it("shows both years when they differ", () => {
    expect(formatPeriod({ start: "2026-12-28", end: "2027-01-27" })).toBe(
      "28 Dec 2026 – 27 Jan 2027",
    );
  });
});
