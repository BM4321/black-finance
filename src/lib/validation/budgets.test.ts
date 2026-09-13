import { describe, expect, it } from "vitest";

import { budgetSchema, copyBudgetSchema } from "@/lib/validation/budgets";

const CAT_A = "20000000-0000-4000-8000-000000000001";
const CAT_B = "20000000-0000-4000-8000-000000000002";

describe("budgetSchema", () => {
  it("accepts a valid month with parallel category/amount arrays", () => {
    const result = budgetSchema.parse({
      periodMonth: "2026-09",
      categoryIds: [CAT_A, CAT_B],
      amounts: ["1000", "500.50"],
    });
    expect(result.categoryIds).toHaveLength(2);
  });

  it("accepts an empty amount for a category (unbudgeted)", () => {
    expect(
      budgetSchema.safeParse({
        periodMonth: "2026-09",
        categoryIds: [CAT_A],
        amounts: [""],
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed month", () => {
    expect(
      budgetSchema.safeParse({
        periodMonth: "September",
        categoryIds: [CAT_A],
        amounts: ["100"],
      }).success,
    ).toBe(false);
  });

  it("rejects a non-numeric amount", () => {
    expect(
      budgetSchema.safeParse({
        periodMonth: "2026-09",
        categoryIds: [CAT_A],
        amounts: ["abc"],
      }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid category", () => {
    expect(
      budgetSchema.safeParse({
        periodMonth: "2026-09",
        categoryIds: ["nope"],
        amounts: ["100"],
      }).success,
    ).toBe(false);
  });
});

describe("copyBudgetSchema", () => {
  it("accepts two valid months", () => {
    expect(
      copyBudgetSchema.safeParse({ fromMonth: "2026-08", toMonth: "2026-09" })
        .success,
    ).toBe(true);
  });

  it("rejects a malformed target month", () => {
    expect(
      copyBudgetSchema.safeParse({ fromMonth: "2026-08", toMonth: "26-09" })
        .success,
    ).toBe(false);
  });
});
