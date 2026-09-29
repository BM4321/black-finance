import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import {
  RECOVERY_COOKIE,
  recoveryCookieOptions,
  RESET_PASSWORD_PATH,
} from "@/lib/auth/recovery";
import { safeRedirect } from "@/lib/redirect";
import { ACTIVITY_COOKIE, activityCookieOptions } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "recovery",
  "signup",
  "invite",
  "magiclink",
  "email_change",
  "email",
];

/**
 * Landing point for links in Supabase emails (password reset, email
 * confirmation).
 *
 * Supports both link styles:
 * - `?token_hash=…&type=recovery` from an email template pointing here
 *   directly; works even if the email is opened on another device.
 * - `?code=…` from Supabase's default template (PKCE); works in the browser
 *   that requested the email.
 *
 * Password reset links return to /reset-password; the proxy forwards their
 * code here with `next=/reset-password`.
 *
 * On success the user is signed in and sent to `next` (only internal paths are
 * allowed). For a password reset it also sets the recovery marker that the
 * reset page requires. On failure a reset lands on /reset-password's
 * "link expired" state; other links land on /forgot-password.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirect(searchParams.get("next"), "/dashboard");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const isRecovery = next === RESET_PASSWORD_PATH;
  const supabase = await createClient();
  let ok = false;
  let userId: string | undefined;
  try {
    if (tokenHash && type && (OTP_TYPES as readonly string[]).includes(type)) {
      const { data, error } = await supabase.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash: tokenHash,
      });
      ok = !error;
      userId = data.user?.id;
    } else if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      ok = !error;
      userId = data.user?.id;
    }
  } catch {
    ok = false;
  }

  if (!ok || (isRecovery && !userId)) {
    const failure = isRecovery
      ? `${RESET_PASSWORD_PATH}?error=invalid_link`
      : "/forgot-password?link=expired";
    return NextResponse.redirect(new URL(failure, request.url));
  }

  // A fresh session starts a fresh idle window (see lib/session.ts).
  const cookieStore = await cookies();
  cookieStore.set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions());
  if (isRecovery && userId) {
    // Proves to the reset page that this session came from a reset link.
    cookieStore.set(RECOVERY_COOKIE, userId, recoveryCookieOptions());
  }

  return NextResponse.redirect(new URL(next, request.url));
}
