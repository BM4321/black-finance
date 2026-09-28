import { z } from "zod";

/**
 * Shared auth schemas.
 *
 * Validated on the client for fast feedback *and* re-parsed on the server,
 * because client validation is a UX feature, never a security control.
 */

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .toLowerCase();

// Length beats composition rules for real-world strength. We require 8+ chars.
const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long"); // bcrypt (Supabase) truncates beyond 72 bytes

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name is too long"),
  email,
  password,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

/** "Forgot password": just the email the reset link goes to. */
export const forgotPasswordSchema = z.object({ email });

/** Choosing a new password from a reset link: typed twice to catch typos. */
export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    message: "The passwords don’t match",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
