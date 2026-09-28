import { describe, expect, it } from "vitest";

import {
  isNewUser,
  parseTourProgress,
  TOUR_STEPS,
  tourStorageKey,
} from "@/lib/ui/tour";

describe("TOUR_STEPS", () => {
  it("has unique ids", () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only visits app pages", () => {
    for (const step of TOUR_STEPS) {
      expect(step.path).toMatch(/^\/(dashboard|accounts|transactions|budgets|goals)(\/new)?$/);
    }
  });

  it("starts with a welcome and ends on the replay button", () => {
    expect(TOUR_STEPS[0].targets).toEqual([]);
    expect(TOUR_STEPS.at(-1)?.targets).toContain("tour-restart");
  });

  it("gives every step readable copy", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(3);
      expect(step.body.length).toBeGreaterThan(20);
    }
  });
});

describe("parseTourProgress", () => {
  it("reads valid progress", () => {
    expect(parseTourProgress('{"status":"active","index":3}')).toEqual({
      status: "active",
      index: 3,
    });
    expect(parseTourProgress('{"status":"done","index":0}')?.status).toBe("done");
  });

  it("ignores missing or malformed values", () => {
    expect(parseTourProgress(null)).toBeNull();
    expect(parseTourProgress("not json")).toBeNull();
    expect(parseTourProgress('{"status":"weird"}')).toBeNull();
  });

  it("restarts an out-of-range index at the first step", () => {
    expect(parseTourProgress('{"status":"active","index":999}')).toEqual({
      status: "active",
      index: 0,
    });
  });
});

describe("isNewUser", () => {
  const now = Date.parse("2026-09-28T12:00:00Z");

  it("is true within two weeks of signing up", () => {
    expect(isNewUser("2026-09-20T00:00:00Z", now)).toBe(true);
  });

  it("is false for older accounts or unknown dates", () => {
    expect(isNewUser("2026-08-01T00:00:00Z", now)).toBe(false);
    expect(isNewUser(undefined, now)).toBe(false);
    expect(isNewUser("garbage", now)).toBe(false);
  });
});

describe("tourStorageKey", () => {
  it("is per user", () => {
    expect(tourStorageKey("a")).not.toBe(tourStorageKey("b"));
  });
});
