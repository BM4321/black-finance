import { describe, expect, it } from "vitest";

import { isActiveRoute, NAV_ITEMS } from "@/lib/ui/nav";

describe("isActiveRoute", () => {
  it("matches the exact route", () => {
    expect(isActiveRoute("/goals", "/goals")).toBe(true);
  });

  it("matches a nested route", () => {
    expect(isActiveRoute("/goals/abc/edit", "/goals")).toBe(true);
  });

  it("does not match a different route", () => {
    expect(isActiveRoute("/reports", "/goals")).toBe(false);
  });

  it("does not treat a shared prefix as active", () => {
    // "/goalsomething" must not match "/goals".
    expect(isActiveRoute("/goalsomething", "/goals")).toBe(false);
  });

  it("does not match the root against a route", () => {
    expect(isActiveRoute("/", "/dashboard")).toBe(false);
  });
});

describe("NAV_ITEMS", () => {
  it("has unique hrefs and labels", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    const labels = NAV_ITEMS.map((item) => item.label);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("covers the main app sections", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    for (const expected of [
      "/dashboard",
      "/transactions",
      "/accounts",
      "/budgets",
      "/goals",
      "/investments",
      "/debts",
      "/reports",
    ]) {
      expect(hrefs).toContain(expected);
    }
  });
});
