import { describe, expect, it } from "vitest";

import { safeRedirect } from "@/lib/redirect";

describe("safeRedirect", () => {
  it("allows internal paths", () => {
    expect(safeRedirect("/dashboard")).toBe("/dashboard");
    expect(safeRedirect("/transactions?page=2")).toBe("/transactions?page=2");
  });

  it("falls back when no target is given", () => {
    expect(safeRedirect(undefined)).toBe("/dashboard");
    expect(safeRedirect(null)).toBe("/dashboard");
    expect(safeRedirect("")).toBe("/dashboard");
  });

  it("rejects absolute URLs (open redirect)", () => {
    expect(safeRedirect("https://evil.com")).toBe("/dashboard");
    expect(safeRedirect("http://evil.com/x")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirect("//evil.com")).toBe("/dashboard");
  });

  it("rejects backslash bypasses browsers normalise to //", () => {
    expect(safeRedirect("/\\evil.com")).toBe("/dashboard");
  });

  it("honours a custom fallback", () => {
    expect(safeRedirect("https://evil.com", "/login")).toBe("/login");
  });
});
