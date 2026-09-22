import { describe, expect, it } from "vitest";

import { investmentSchema } from "@/lib/validation/investments";

const valid = {
  name: "NMB shares",
  assetType: "stock",
  quantity: "10",
  purchasePrice: "1000",
  purchaseDate: "2026-01-15",
  currentValue: "12000",
  notes: "",
};

describe("investmentSchema", () => {
  it("accepts a valid investment", () => {
    const result = investmentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("NMB shares");
      expect(result.data.assetType).toBe("stock");
      expect(result.data.currentValue).toBe("12000");
      expect(result.data.notes).toBeUndefined();
    }
  });

  it("treats a blank current value as not set (falls back to cost)", () => {
    const result = investmentSchema.safeParse({ ...valid, currentValue: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currentValue).toBeUndefined();
  });

  it("treats a blank purchase date as no date", () => {
    const result = investmentSchema.safeParse({ ...valid, purchaseDate: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.purchaseDate).toBeUndefined();
  });

  it("requires a name", () => {
    expect(investmentSchema.safeParse({ ...valid, name: "  " }).success).toBe(
      false,
    );
  });

  it("rejects an unknown asset type", () => {
    expect(
      investmentSchema.safeParse({ ...valid, assetType: "nft" }).success,
    ).toBe(false);
  });

  it("rejects a negative quantity", () => {
    expect(
      investmentSchema.safeParse({ ...valid, quantity: "-1" }).success,
    ).toBe(false);
  });

  it("allows a zero purchase price (free acquisition)", () => {
    expect(
      investmentSchema.safeParse({ ...valid, purchasePrice: "0" }).success,
    ).toBe(true);
  });

  it("rejects a malformed purchase date", () => {
    expect(
      investmentSchema.safeParse({ ...valid, purchaseDate: "15/01/2026" })
        .success,
    ).toBe(false);
  });

  it("rejects a non-numeric current value", () => {
    expect(
      investmentSchema.safeParse({ ...valid, currentValue: "abc" }).success,
    ).toBe(false);
  });
});
