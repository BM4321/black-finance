import { describe, expect, it } from "vitest";

import { parseSidebarCollapsed } from "@/lib/ui/sidebar";

describe("parseSidebarCollapsed", () => {
  it("is collapsed only for the literal 'true'", () => {
    expect(parseSidebarCollapsed("true")).toBe(true);
  });

  it("is expanded for anything else", () => {
    expect(parseSidebarCollapsed("false")).toBe(false);
    expect(parseSidebarCollapsed("1")).toBe(false);
    expect(parseSidebarCollapsed("")).toBe(false);
    expect(parseSidebarCollapsed(undefined)).toBe(false);
  });
});
