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

describe("budgetSchema periods", () => {
  const base = { periodMonth: "2026-09-01", categoryIds: [CAT_A], amounts: ["100"] };

  it("defaults to a calendar month when no period is sent", () => {
    expect(budgetSchema.parse(base).periodType).toBe("calendar");
  });

  it("accepts a payday-to-payday custom period", () => {
    const result = budgetSchema.parse({
      ...base,
      periodType: "custom",
      startDate: "2026-09-25",
      endDate: "2026-10-24",
    });
    expect(result.startDate).toBe("2026-09-25");
  });

  it("accepts a custom period starting in the previous month", () => {
    const result = budgetSchema.safeParse({
      ...base,
      periodType: "custom",
      startDate: "2026-08-24",
      endDate: "2026-09-23",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a custom period with no day in the budget's month", () => {
    const result = budgetSchema.safeParse({
      ...base,
      periodType: "custom",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a custom period whose end precedes its start", () => {
    expect(
      budgetSchema.safeParse({
        ...base,
        periodType: "custom",
        startDate: "2026-09-25",
        endDate: "2026-09-01",
      }).success,
    ).toBe(false);
  });

  it("ignores date fields for a calendar budget", () => {
    expect(
      budgetSchema.safeParse({ ...base, periodType: "calendar", startDate: "", endDate: "" })
        .success,
    ).toBe(true);
  });
});
