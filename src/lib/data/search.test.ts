import { describe, expect, it } from "vitest";

import {
  normalizeSearchTerm,
  postgrestSearchPattern,
} from "@/lib/data/search";

describe("normalizeSearchTerm", () => {
  it("trims whitespace", () => {
    expect(normalizeSearchTerm("  coffee  ")).toBe("coffee");
  });

  it("treats blank input as no search", () => {
    expect(normalizeSearchTerm(undefined)).toBeNull();
    expect(normalizeSearchTerm("")).toBeNull();
    expect(normalizeSearchTerm("   ")).toBeNull();
  });

  it("strips quotes and backslashes that PostgREST treats as syntax", () => {
    expect(normalizeSearchTerm('he said "hi"')).toBe("he said hi");
    expect(normalizeSearchTerm("back\\slash")).toBe("backslash");
  });

  it("caps the term length", () => {
    const long = "a".repeat(250);
    expect(normalizeSearchTerm(long)?.length).toBe(100);
  });
});

describe("postgrestSearchPattern", () => {
  it("wraps the term as a quoted contains pattern", () => {
    expect(postgrestSearchPattern("coffee")).toBe('"*coffee*"');
  });

  it("leaves * for PostgREST to expand to a wildcard", () => {
    // PostgREST maps `*` to `%` inside ilike. Escaping it here would make the
    // list treat `*` literally while the SQL totals treated it as a wildcard.
    expect(postgrestSearchPattern("50*")).toBe('"*50**"');
  });

  it("keeps % and _ as wildcards, matching Postgres LIKE", () => {
    expect(postgrestSearchPattern("a%b")).toBe('"*a%b*"');
    expect(postgrestSearchPattern("a_b")).toBe('"*a_b*"');
  });
});
