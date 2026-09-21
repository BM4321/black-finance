import { describe, expect, it } from "vitest";

import {
  contributionSchema,
  goalSchema,
} from "@/lib/validation/goals";

describe("goalSchema", () => {
  const valid = {
    name: "Driving lessons",
    targetAmount: "300000",
    targetDate: "2026-12-31",
    notes: "",
  };

  it("accepts a valid goal", () => {
    const result = goalSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Driving lessons");
      expect(result.data.targetAmount).toBe("300000");
      expect(result.data.targetDate).toBe("2026-12-31");
      expect(result.data.notes).toBeUndefined();
    }
  });

  it("treats an empty deadline as no deadline", () => {
    const result = goalSchema.safeParse({ ...valid, targetDate: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.targetDate).toBeUndefined();
  });

  it("rejects a missing name", () => {
    expect(goalSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });

  it("rejects a zero or negative target", () => {
    expect(goalSchema.safeParse({ ...valid, targetAmount: "0" }).success).toBe(
      false,
    );
    expect(
      goalSchema.safeParse({ ...valid, targetAmount: "-100" }).success,
    ).toBe(false);
  });

  it("rejects a malformed deadline", () => {
    expect(
      goalSchema.safeParse({ ...valid, targetDate: "31/12/2026" }).success,
    ).toBe(false);
  });
});

describe("contributionSchema", () => {
  const goalId = "11111111-1111-4111-8111-111111111111";
  const valid = {
    goalId,
    amount: "50000",
    contributedOn: "2026-09-20",
    note: "",
  };

  it("accepts a valid contribution", () => {
    const result = contributionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBeUndefined();
  });

  it("requires a positive amount", () => {
    expect(
      contributionSchema.safeParse({ ...valid, amount: "0" }).success,
    ).toBe(false);
  });

  it("requires a uuid goal id", () => {
    expect(
      contributionSchema.safeParse({ ...valid, goalId: "nope" }).success,
    ).toBe(false);
  });

  it("requires a valid date", () => {
    expect(
      contributionSchema.safeParse({ ...valid, contributedOn: "today" }).success,
    ).toBe(false);
  });
});
