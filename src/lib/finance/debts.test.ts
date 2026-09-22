import { describe, expect, it } from "vitest";

import {
  daysUntilDue,
  isOverdue,
  settlementProgress,
} from "@/lib/finance/debts";

describe("settlementProgress", () => {
  it("is zero when nothing is settled", () => {
    expect(settlementProgress("2000", "2000")).toBe(0);
  });

  it("is one when fully settled", () => {
    expect(settlementProgress("2000", "0")).toBe(1);
  });

  it("is the settled fraction otherwise", () => {
    // 2000 principal, 1500 remaining -> 500 settled = 25%
    expect(settlementProgress("2000", "1500")).toBeCloseTo(0.25);
  });

  it("uses exact minor units", () => {
    expect(settlementProgress("0.30", "0.20")).toBeCloseTo(1 / 3, 10);
  });

  it("clamps to 0..1", () => {
    // Remaining above principal would be invalid, but clamp defensively.
    expect(settlementProgress("100", "150")).toBe(0);
    expect(settlementProgress("100", "-50")).toBe(1);
  });

  it("is zero for a zero principal (no division by zero)", () => {
    expect(settlementProgress("0", "0")).toBe(0);
  });
});

describe("daysUntilDue", () => {
  const today = new Date("2026-09-20T00:00:00Z");

  it("counts forward to the due date", () => {
    expect(daysUntilDue("2026-09-30", today)).toBe(10);
  });

  it("is negative when past due", () => {
    expect(daysUntilDue("2026-09-10", today)).toBe(-10);
  });

  it("is null without a due date", () => {
    expect(daysUntilDue(null, today)).toBeNull();
    expect(daysUntilDue(undefined, today)).toBeNull();
  });

  it("is null for a malformed date", () => {
    expect(daysUntilDue("not-a-date", today)).toBeNull();
  });
});

describe("isOverdue", () => {
  const today = new Date("2026-09-20T00:00:00Z");

  it("is true for an open debt past its due date", () => {
    expect(isOverdue("open", "2026-09-01", today)).toBe(true);
  });

  it("is false for an open debt not yet due", () => {
    expect(isOverdue("open", "2026-10-01", today)).toBe(false);
  });

  it("is false when there is no due date", () => {
    expect(isOverdue("open", null, today)).toBe(false);
  });

  it("is false for settled or written-off debts", () => {
    expect(isOverdue("settled", "2026-09-01", today)).toBe(false);
    expect(isOverdue("written_off", "2026-09-01", today)).toBe(false);
  });
});
