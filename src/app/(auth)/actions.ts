"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeRedirect } from "@/lib/redirect";
import { ACTIVITY_COOKIE, activityCookieOptions } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

/**
 * Shape returned to forms via useActionState.
 *
 * `errors` is keyed by field for inline display; `formError` is a
 * non-field-specific message (e.g. "Invalid email or password").
 */
export type AuthActionState = {
  errors?: Record<string, string[]>;
  formError?: string;
  formNotice?: string;
  values?: { fullName?: string; email?: string };
};

function firstUrl(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Start a fresh idle window for a new session.
 *
 * Without this, a clock cookie left over from an earlier session (one that
 * Supabase ended on its own, e.g. its inactivity limit or a password change)
 * would make the first request after signing in look hours idle, and the
 * proxy would sign the user straight back out.
 */
async function startIdleClock(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions());
}

export async function signUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: {
        fullName: firstUrl(formData.get("fullName")),
        email: firstUrl(formData.get("email")),
      },
    };
  }

  const supabase = await createClient();

  let data: Awaited<ReturnType<typeof supabase.auth.signUp>>["data"];
  try {
    const result = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
      },
    });
    if (result.error) {
      return {
        formError: result.error.message,
        values: { fullName: parsed.data.fullName, email: parsed.data.email },
      };
    }
    data = result.data;
  } catch {
    // Thrown on network/configuration failures (e.g. unreachable Supabase URL).
    // Surface a friendly message rather than crashing the Server Action.
    return {
      formError:
        "Could not reach the authentication service. Check your connection and try again.",
      values: { fullName: parsed.data.fullName, email: parsed.data.email },
    };
  }

  // When email confirmation is enabled, Supabase returns no session. We must
  // tell the user to confirm rather than redirecting them into a dead app.
  if (!data.session) {
    return {
      formNotice: "Check your inbox to confirm your email, then sign in.",
      values: { email: parsed.data.email },
    };
  }

  await startIdleClock();
  // redirect() throws internally, so it must stay outside the try/catch above.
  redirect("/dashboard");
}

export async function signIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: { email: firstUrl(formData.get("email")) },
    };
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      // Deliberately vague: do not reveal whether the email exists.
      return {
        formError: "Invalid email or password.",
        values: { email: parsed.data.email },
      };
    }
  } catch {
    return {
      formError:
        "Could not reach the authentication service. Check your connection and try again.",
      values: { email: parsed.data.email },
    };
  }

  await startIdleClock();
  const redirectTo = firstUrl(formData.get("redirectTo"));
  // redirect() throws internally, so it must stay outside the try/catch above.
  redirect(safeRedirect(redirectTo));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch {
    // Even if the network call fails, clear the local session and return to
    // the login screen. A stuck logged-in UI is worse than an unconfirmed
    // server-side logout.
  }

  // Clear the idle clock so a fresh sign-in starts a new window.
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVITY_COOKIE);

  redirect("/login");
}

/**
 * Sign out because the browser has been idle for the whole window.
 *
 * Called by the client-side idle timer, so data does not stay on an unattended
 * screen until the next click. Lands on the login screen with the timeout
 * notice and a way back to the page the user was on.
 */
export async function endIdleSession(currentPath: string): Promise<void> {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch {
    // As in signOut(): never leave the UI stuck signed in.
  }

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVITY_COOKIE);

  const params = new URLSearchParams({ expired: "1" });
  const back = safeRedirect(currentPath, "");
  if (back) params.set("redirectTo", back);
  redirect(`/login?${params.toString()}`);
}

/**
 * Keep-alive for the idle clock.
 *
 * Intentionally empty: the request itself passes through the proxy, which
 * refreshes the activity cookie for a signed-in user. The idle timer calls it
 * (throttled) while the user is interacting without navigating, e.g. reading
 * a report or filling in a long form, so the server-side window measures real
 * inactivity rather than time since the last page load.
 */
export async function touchSession(): Promise<void> {}

/**
 * The site's own origin, for links in emails.
 *
 * SITE_URL (server-only) wins when set, e.g. to force the production domain;
 * otherwise the request's Origin header, which browsers send with every
 * Server Action. Supabase only redirects to URLs on its allow list (Auth →
 * URL Configuration), so a spoofed header cannot send a link elsewhere.
 */
async function siteOrigin(): Promise<string> {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) return origin;
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Email a password reset link.
 *
 * Always answers with the same notice whether or not an account exists, so
 * the form cannot be used to discover who has an account. The link lands on
 * /auth/confirm, which signs the user in for the reset and forwards them to
 * /reset-password.
 */
export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: { email: firstUrl(formData.get("email")) },
    };
  }

  const supabase = await createClient();
  const redirectTo = `${await siteOrigin()}/auth/confirm?next=/reset-password`;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo,
    });
    if (error?.status === 429) {
      return {
        formError: "Too many reset requests. Wait a minute, then try again.",
        values: { email: parsed.data.email },
      };
    }
    if (error) {
      // Not shown to the user (the notice stays neutral), but logged so a
      // misconfiguration, such as the redirect URL missing from Supabase's
      // allow list, is visible in the server logs.
      console.error("Password reset request failed:", error.status, error.message);
    }
  } catch {
    return {
      formError:
        "Could not reach the authentication service. Check your connection and try again.",
      values: { email: parsed.data.email },
    };
  }

  return {
    formNotice:
      "If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).",
    values: { email: parsed.data.email },
  };
}

/**
 * Set a new password for the user signed in by a reset link.
 *
 * The reset link creates a short-lived session (see /auth/confirm); without
 * one the link has expired or was already used.
 */
export async function updatePassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        formError: "This reset link has expired or was already used. Request a new one.",
      };
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      // e.g. "New password should be different from the old password."
      return { formError: error.message };
    }
  } catch {
    return {
      formError:
        "Could not reach the authentication service. Check your connection and try again.",
    };
  }

  await startIdleClock();
  // redirect() throws internally, so it must stay outside the try/catch above.
  redirect("/dashboard?passwordReset=1");
}
