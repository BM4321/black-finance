import { describe, expect, it } from "vitest";

import {
  classifyGoal,
  daysUntil,
  goalProgressWidth,
  monthlyPace,
} from "@/lib/finance/goals";

describe("classifyGoal", () => {
  it("is not started at zero or below", () => {
    expect(classifyGoal(0)).toBe("not_started");
    expect(classifyGoal(-5)).toBe("not_started");
    expect(classifyGoal(Number.NaN)).toBe("not_started");
  });

  it("is in progress between zero and one hundred", () => {
    expect(classifyGoal(0.1)).toBe("in_progress");
    expect(classifyGoal(40)).toBe("in_progress");
    expect(classifyGoal(99.9)).toBe("in_progress");
  });

  it("is complete at or above one hundred", () => {
    expect(classifyGoal(100)).toBe("complete");
    expect(classifyGoal(150)).toBe("complete");
  });
});

describe("goalProgressWidth", () => {
  it("passes through normal values", () => {
    expect(goalProgressWidth(40)).toBe(40);
  });

  it("clamps above 100", () => {
    expect(goalProgressWidth(180)).toBe(100);
  });

  it("clamps negatives and NaN to zero", () => {
    expect(goalProgressWidth(-1)).toBe(0);
    expect(goalProgressWidth(Number.NaN)).toBe(0);
  });
});

describe("daysUntil", () => {
  const today = new Date("2026-09-20T00:00:00Z");

  it("counts forward to the target date", () => {
    expect(daysUntil("2026-09-30", today)).toBe(10);
  });

  it("is negative for a past date", () => {
    expect(daysUntil("2026-09-10", today)).toBe(-10);
  });

  it("is zero for today", () => {
    expect(daysUntil("2026-09-20", today)).toBe(0);
  });

  it("is null without a date", () => {
    expect(daysUntil(null, today)).toBeNull();
    expect(daysUntil(undefined, today)).toBeNull();
  });

  it("is null for a malformed date", () => {
    expect(daysUntil("not-a-date", today)).toBeNull();
  });
});

describe("monthlyPace", () => {
  const today = new Date("2026-09-20T00:00:00Z");

  it("spreads the remainder over the whole months left", () => {
    // Target 30 days out: ceil(30.44/30.44) = 1 month, so all of it.
    expect(monthlyPace("300000", "2026-10-20", today)).toBe("300000.00");
  });

  it("rounds up so the plan never falls short", () => {
    // Target 90 days out: ceil(90/30.44) = 3 months. 100000 / 3 rounds up.
    expect(monthlyPace("100000", "2026-12-19", today)).toBe("33333.34");
  });

  it("is null without a deadline", () => {
    expect(monthlyPace("100000", null, today)).toBeNull();
  });

  it("is null once the deadline has passed", () => {
    expect(monthlyPace("100000", "2026-09-01", today)).toBeNull();
  });

  it("is zero when nothing remains", () => {
    expect(monthlyPace("0", "2026-12-01", today)).toBe("0.00");
  });
});
