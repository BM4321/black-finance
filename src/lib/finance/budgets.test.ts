import { describe, expect, it } from "vitest";

import {
  BUDGET_WARNING_THRESHOLD,
  classifyBudget,
  progressWidth,
  sumBudgetInputs,
  unallocated,
} from "@/lib/finance/budgets";

describe("classifyBudget", () => {
  it("is safe below the warning threshold", () => {
    expect(classifyBudget(0)).toBe("safe");
    expect(classifyBudget(50)).toBe("safe");
    expect(classifyBudget(BUDGET_WARNING_THRESHOLD - 1)).toBe("safe");
  });

  it("warns from the threshold up to and including 100", () => {
    expect(classifyBudget(BUDGET_WARNING_THRESHOLD)).toBe("warning");
    expect(classifyBudget(99)).toBe("warning");
    expect(classifyBudget(100)).toBe("warning");
  });

  it("is over above 100", () => {
    expect(classifyBudget(100.1)).toBe("over");
    expect(classifyBudget(250)).toBe("over");
  });

  it("treats any spend against a zero budget as over", () => {
    // The database returns 100 for spending against a zero budget.
    expect(classifyBudget(100)).toBe("warning");
    // ...but a genuinely over zero budget (percent > 100) is over.
    expect(classifyBudget(150)).toBe("over");
  });
});

describe("progressWidth", () => {
  it("passes through normal values", () => {
    expect(progressWidth(42)).toBe(42);
  });

  it("clamps above 100 so the bar never overflows", () => {
    expect(progressWidth(180)).toBe(100);
  });

  it("clamps negatives and NaN to zero", () => {
    expect(progressWidth(-5)).toBe(0);
    expect(progressWidth(Number.NaN)).toBe(0);
  });
});

describe("sumBudgetInputs", () => {
  it("sums valid amounts exactly", () => {
    expect(sumBudgetInputs(["1000", "250.50", "99.50"])).toBe("1350.00");
  });

  it("ignores blank and partially typed values while editing", () => {
    expect(sumBudgetInputs(["", "500", ".", "1."])).toBe("500.00");
  });

  it("avoids float drift across many entries", () => {
    const amounts = Array.from({ length: 100 }, () => "0.01");
    expect(sumBudgetInputs(amounts)).toBe("1.00");
  });

  it("returns zero for no entries", () => {
    expect(sumBudgetInputs([])).toBe("0.00");
  });
});

describe("unallocated", () => {
  it("returns what is left of the planning amount", () => {
    expect(unallocated("1000000", "750000")).toBe("250000.00");
  });

  it("goes negative when over-allocated", () => {
    expect(unallocated("500000", "600000")).toBe("-100000.00");
  });

  it("treats a blank planning amount as zero", () => {
    expect(unallocated("", "100")).toBe("-100.00");
  });

  it("is exact across decimal inputs", () => {
    expect(unallocated("100.10", "0.10")).toBe("100.00");
  });
});
