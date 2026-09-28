import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

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
 * On success the user is signed in and sent to `next` (only internal paths are
 * allowed). On failure they land on /forgot-password with an explanation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirect(searchParams.get("next"), "/dashboard");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;
  try {
    if (tokenHash && type && (OTP_TYPES as readonly string[]).includes(type)) {
      const { error } = await supabase.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash: tokenHash,
      });
      ok = !error;
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      ok = !error;
    }
  } catch {
    ok = false;
  }

  if (!ok) {
    return NextResponse.redirect(new URL("/forgot-password?link=expired", request.url));
  }

  // A fresh session starts a fresh idle window (see lib/session.ts).
  const cookieStore = await cookies();
  cookieStore.set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions());

  return NextResponse.redirect(new URL(next, request.url));
}
