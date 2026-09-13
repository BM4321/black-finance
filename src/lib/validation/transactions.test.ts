import { describe, expect, it } from "vitest";

import { transactionSchema } from "@/lib/validation/transactions";

const ACCOUNT = "10000000-0000-4000-8000-000000000001";
const ACCOUNT_2 = "10000000-0000-4000-8000-000000000002";
const CATEGORY = "20000000-0000-4000-8000-000000000001";

const base = {
  amount: "1000",
  occurredOn: "2026-01-15",
  description: "Groceries",
  payee: "",
  notes: "",
};

describe("transactionSchema", () => {
  it("accepts a valid expense", () => {
    const result = transactionSchema.parse({
      ...base,
      type: "expense",
      accountId: ACCOUNT,
      categoryId: CATEGORY,
    });
    expect(result.type).toBe("expense");
    expect(result.payee).toBeUndefined();
  });

  it("accepts a valid income", () => {
    expect(
      transactionSchema.safeParse({
        ...base,
        type: "income",
        accountId: ACCOUNT,
        categoryId: CATEGORY,
      }).success,
    ).toBe(true);
  });

  it("accepts a valid transfer between different accounts", () => {
    expect(
      transactionSchema.safeParse({
        ...base,
        type: "transfer",
        accountId: ACCOUNT,
        transferAccountId: ACCOUNT_2,
      }).success,
    ).toBe(true);
  });

  it("rejects a transfer to the same account", () => {
    const result = transactionSchema.safeParse({
      ...base,
      type: "transfer",
      accountId: ACCOUNT,
      transferAccountId: ACCOUNT,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an expense without a category", () => {
    expect(
      transactionSchema.safeParse({
        ...base,
        type: "expense",
        accountId: ACCOUNT,
      }).success,
    ).toBe(false);
  });

  it("rejects zero and negative amounts", () => {
    for (const amount of ["0", "-5"]) {
      expect(
        transactionSchema.safeParse({
          ...base,
          amount,
          type: "expense",
          accountId: ACCOUNT,
          categoryId: CATEGORY,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects a malformed date", () => {
    expect(
      transactionSchema.safeParse({
        ...base,
        occurredOn: "15/01/2026",
        type: "expense",
        accountId: ACCOUNT,
        categoryId: CATEGORY,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid account", () => {
    expect(
      transactionSchema.safeParse({
        ...base,
        type: "expense",
        accountId: "not-a-uuid",
        categoryId: CATEGORY,
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown transaction type", () => {
    expect(
      transactionSchema.safeParse({
        ...base,
        type: "refund",
        accountId: ACCOUNT,
        categoryId: CATEGORY,
      }).success,
    ).toBe(false);
  });
});
