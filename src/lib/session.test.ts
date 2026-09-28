import { describe, expect, it } from "vitest";

import {
  ACTIVITY_COOKIE,
  DEFAULT_IDLE_MINUTES,
  idlePhase,
  isIdleExpired,
  parseActivity,
} from "@/lib/session";

const MINUTE = 60_000;

describe("isIdleExpired", () => {
  const now = 1_700_000_000_000;

  it("is not expired within the window", () => {
    expect(isIdleExpired(now - 5 * MINUTE, now, 30)).toBe(false);
    expect(isIdleExpired(now, now, 30)).toBe(false);
  });

  it("is not expired exactly at the boundary", () => {
    expect(isIdleExpired(now - 30 * MINUTE, now, 30)).toBe(false);
  });

  it("is expired just past the window", () => {
    expect(isIdleExpired(now - 30 * MINUTE - 1, now, 30)).toBe(true);
    expect(isIdleExpired(now - 31 * MINUTE, now, 30)).toBe(true);
  });

  it("treats a missing timestamp as not expired", () => {
    // NaN means the cookie is absent: start the clock rather than logging out.
    expect(isIdleExpired(Number.NaN, now, 30)).toBe(false);
  });

  it("uses the 30 minute default", () => {
    expect(DEFAULT_IDLE_MINUTES).toBe(30);
    expect(isIdleExpired(now - 29 * MINUTE, now)).toBe(false);
    expect(isIdleExpired(now - 31 * MINUTE, now)).toBe(true);
  });
});

describe("parseActivity", () => {
  it("parses a numeric timestamp", () => {
    expect(parseActivity("1700000000000")).toBe(1_700_000_000_000);
  });

  it("returns NaN for missing or malformed values", () => {
    expect(Number.isNaN(parseActivity(undefined))).toBe(true);
    expect(Number.isNaN(parseActivity(""))).toBe(true);
    expect(Number.isNaN(parseActivity("not-a-number"))).toBe(true);
  });
});

describe("ACTIVITY_COOKIE", () => {
  it("has a stable name", () => {
    expect(ACTIVITY_COOKIE).toBe("bf_last_activity");
  });
});

describe("idlePhase", () => {
  const now = 1_700_000_000_000;
  const warning = 60_000;

  it("is active well inside the window", () => {
    expect(idlePhase(now - 5 * MINUTE, now, 30, warning)).toEqual({
      phase: "active",
      remainingMs: 25 * MINUTE,
    });
  });

  it("warns in the final minute", () => {
    expect(idlePhase(now - 29.5 * MINUTE, now, 30, warning)).toEqual({
      phase: "warning",
      remainingMs: 0.5 * MINUTE,
    });
  });

  it("warns exactly at the warning threshold", () => {
    expect(idlePhase(now - 29 * MINUTE, now, 30, warning).phase).toBe("warning");
  });

  it("is expired at and past the window, with no negative remainder", () => {
    expect(idlePhase(now - 30 * MINUTE, now, 30, warning)).toEqual({
      phase: "expired",
      remainingMs: 0,
    });
    expect(idlePhase(now - 45 * MINUTE, now, 30, warning).remainingMs).toBe(0);
  });
});
