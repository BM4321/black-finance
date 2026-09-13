import { describe, expect, it } from "vitest";

import { accountSchema } from "@/lib/validation/accounts";

const valid = {
  name: "NMB Bank",
  type: "bank",
  currency: "TZS",
  openingBalance: "1000",
  notes: "",
};

describe("accountSchema", () => {
  it("accepts valid input and uppercases currency", () => {
    const result = accountSchema.parse({ ...valid, currency: "tzs" });
    expect(result.currency).toBe("TZS");
    expect(result.name).toBe("NMB Bank");
  });

  it("treats empty notes as undefined", () => {
    expect(accountSchema.parse(valid).notes).toBeUndefined();
  });

  it("accepts negative opening balances", () => {
    expect(
      accountSchema.parse({ ...valid, openingBalance: "-250.50" }).openingBalance,
    ).toBe("-250.50");
  });

  it("rejects a non-numeric opening balance", () => {
    expect(
      accountSchema.safeParse({ ...valid, openingBalance: "abc" }).success,
    ).toBe(false);
  });

  it("rejects a bad currency code", () => {
    expect(accountSchema.safeParse({ ...valid, currency: "TS" }).success).toBe(
      false,
    );
    expect(
      accountSchema.safeParse({ ...valid, currency: "TZSX" }).success,
    ).toBe(false);
  });

  it("rejects an unknown account type", () => {
    expect(accountSchema.safeParse({ ...valid, type: "crypto" }).success).toBe(
      false,
    );
  });

  it("rejects an empty name", () => {
    expect(accountSchema.safeParse({ ...valid, name: "  " }).success).toBe(
      false,
    );
  });

  it("rejects an absurdly large amount", () => {
    expect(
      accountSchema.safeParse({ ...valid, openingBalance: "9999999999999999" })
        .success,
    ).toBe(false);
  });
});
