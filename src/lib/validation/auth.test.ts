import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "@/lib/validation/auth";

describe("signUpSchema", () => {
  const valid = {
    fullName: "Amina Hassan",
    email: "amina@example.com",
    password: "correcthorse",
  };

  it("accepts valid input and normalises email", () => {
    const result = signUpSchema.parse({
      ...valid,
      email: "  AMINA@Example.COM ",
    });
    expect(result.email).toBe("amina@example.com");
    expect(result.fullName).toBe("Amina Hassan");
  });

  it("rejects a short password", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = signUpSchema.safeParse({ ...valid, email: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = signUpSchema.safeParse({ ...valid, fullName: "   " });
    expect(result.success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("only requires a non-empty password", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "x" }).success,
    ).toBe(true);
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});
