import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

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

describe("forgotPasswordSchema", () => {
  it("normalises the email", () => {
    expect(forgotPasswordSchema.parse({ email: " Amina@Example.com " }).email).toBe(
      "amina@example.com",
    );
  });

  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords of 8+ characters", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "correcthorse", confirmPassword: "correcthorse" })
        .success,
    ).toBe(true);
  });

  it("rejects mismatched passwords on the confirm field", () => {
    const result = resetPasswordSchema.safeParse({
      password: "correcthorse",
      confirmPassword: "correcthorsf",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("rejects a short password", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "short", confirmPassword: "short" }).success,
    ).toBe(false);
  });
});
