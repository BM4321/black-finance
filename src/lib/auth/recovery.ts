/**
 * Password recovery helpers.
 *
 * The reset email returns the user to /reset-password. The one-time code (or
 * token hash) in that link is exchanged for a short-lived session by
 * /auth/confirm, which also sets RECOVERY_COOKIE: an httpOnly marker holding
 * the user's id. The reset page and the update action require both the
 * session and a matching marker, so a user who is merely signed in cannot
 * change their password there without the emailed link.
 *
 * The marker is not a credential. Supabase's `updateUser` always acts on the
 * session's own user, so no URL parameter or cookie value can target another
 * account; the marker only proves the session came from a recovery link.
 */

/** Name of the httpOnly marker set after a successful recovery exchange. */
export const RECOVERY_COOKIE = "bf_pw_recovery";

/** The page the reset email returns to. */
export const RESET_PASSWORD_PATH = "/reset-password";

/** How long the marker lasts: long enough to type a password, no longer. */
const RECOVERY_MAX_AGE_SECONDS = 15 * 60;

export function recoveryCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    // Only sent to the reset page and the Server Action it posts to.
    path: RESET_PASSWORD_PATH,
    maxAge: RECOVERY_MAX_AGE_SECONDS,
  };
}

/**
 * Set for a moment after a successful reset. Signing out changes cookies, so
 * Next re-renders the page with no session; this flash (together with
 * `?updated=1`) lets the page show "Password updated" instead of "link
 * expired". Requiring the cookie means the URL alone cannot fake the message.
 */
export const RESET_DONE_COOKIE = "bf_pw_reset_done";

export function resetDoneCookieOptions() {
  return { ...recoveryCookieOptions(), maxAge: 120 };
}

/** True when a marker value belongs to the signed-in user. */
export function isRecoveryFor(markerValue: string | undefined, userId: string): boolean {
  return Boolean(markerValue) && markerValue === userId;
}

export type ResetLinkProblem = "expired" | "invalid";

/**
 * Whether the reset page was reached from a failed link.
 *
 * Covers our own `?error=invalid_link` (set by /auth/confirm when the exchange
 * fails) and the parameters Supabase adds when it rejects a link before
 * redirecting (`error=access_denied&error_code=otp_expired`). Works for both
 * the query string and a `#…` fragment parsed into URLSearchParams.
 */
export function resetLinkProblem(params: URLSearchParams): ResetLinkProblem | null {
  const code = params.get("error_code");
  const error = params.get("error");
  if (code === "otp_expired" || code === "flow_state_expired") return "expired";
  if (error === "invalid_link" || error || code) return "invalid";
  return null;
}

/** The shape of the Supabase auth errors we inspect. */
type AuthErrorLike = { code?: string; status?: number } | null | undefined;

/**
 * A message that is safe to show for a failed password update.
 *
 * Known Supabase error codes get specific guidance; anything else gets a
 * generic message, so internal details never reach the page.
 */
export function passwordUpdateError(error: AuthErrorLike): string {
  switch (error?.code) {
    case "same_password":
      return "Choose a password that’s different from your current one.";
    case "weak_password":
      return "That password is too weak. Use a longer one that’s harder to guess.";
    case "session_expired":
    case "session_not_found":
    case "reauthentication_needed":
      return "This reset link has expired. Request a new one.";
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute, then try again.";
    default:
      return "We couldn’t update your password. Please try again.";
  }
}
