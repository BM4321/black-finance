import { describe, expect, it } from "vitest";

import { debtSchema } from "@/lib/validation/debts";

const valid = {
  direction: "owed_by_me",
  counterparty: "Bank",
  principal: "2000",
  remainingAmount: "1500",
  startedOn: "2026-01-15",
  dueDate: "2026-06-15",
  notes: "",
};

describe("debtSchema", () => {
  it("accepts a valid debt", () => {
    const result = debtSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counterparty).toBe("Bank");
      expect(result.data.notes).toBeUndefined();
    }
  });

  it("treats a blank due date as no date", () => {
    const result = debtSchema.safeParse({ ...valid, dueDate: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dueDate).toBeUndefined();
  });

  it("rejects a zero or negative principal", () => {
    expect(
      debtSchema.safeParse({ ...valid, principal: "0" }).success,
    ).toBe(false);
    expect(
      debtSchema.safeParse({ ...valid, principal: "-5" }).success,
    ).toBe(false);
  });

  it("allows a zero remaining amount (fully settled)", () => {
    expect(
      debtSchema.safeParse({ ...valid, remainingAmount: "0" }).success,
    ).toBe(true);
  });

  it("rejects outstanding greater than the original amount", () => {
    const result = debtSchema.safeParse({
      ...valid,
      principal: "1000",
      remainingAmount: "1500",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown direction", () => {
    expect(
      debtSchema.safeParse({ ...valid, direction: "sideways" }).success,
    ).toBe(false);
  });

  it("rejects a missing counterparty", () => {
    expect(
      debtSchema.safeParse({ ...valid, counterparty: "  " }).success,
    ).toBe(false);
  });

  it("rejects a malformed started date", () => {
    expect(
      debtSchema.safeParse({ ...valid, startedOn: "15/01/2026" }).success,
    ).toBe(false);
  });
});
