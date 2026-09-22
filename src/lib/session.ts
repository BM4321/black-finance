/**
 * Idle session timeout.
 *
 * A finance app should not leave a session open indefinitely on an unlocked
 * device. This implements a sliding *idle* window: any request refreshes the
 * clock, and if the gap between two requests exceeds the window the session is
 * ended and the user must sign in again.
 *
 * How it works: an HTTP-only cookie holds the epoch-millisecond timestamp of
 * the last authenticated request. Middleware (see `lib/supabase/proxy.ts`)
 * compares it on every request and refreshes it. The actual session being ended
 * is the Supabase session — this cookie is only the idle clock.
 *
 * SCOPE / TRADE-OFF: this is a UX-level policy control, not the authorization
 * boundary. Authorization is enforced by Supabase auth + Postgres RLS. Because
 * the clock lives in a cookie, a user who deliberately deletes it restarts the
 * window. For a tamper-proof hard limit, also configure Supabase's own Auth →
 * Sessions inactivity timeout. We chose not to sign the cookie: it would
 * require another required secret to configure and deploy, for a control that
 * is not the security boundary.
 */

/** Idle window, in minutes. Override with SESSION_IDLE_MINUTES (server-only). */
export const DEFAULT_IDLE_MINUTES = 30;

function readIdleMinutes(): number {
  const raw = process.env.SESSION_IDLE_MINUTES;
  if (!raw) return DEFAULT_IDLE_MINUTES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_IDLE_MINUTES;
}

export const SESSION_IDLE_MINUTES = readIdleMinutes();

/** Name of the cookie that stores the last-activity timestamp. */
export const ACTIVITY_COOKIE = "bf_last_activity";

/** How long the clock cookie itself lives (7 days). */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * True when the session has been idle longer than the allowed window.
 *
 * A missing or unparsable timestamp is treated as *not* expired so the clock
 * simply (re)starts on the next request. This avoids logging out existing
 * sessions when the feature is first deployed.
 */
export function isIdleExpired(
  lastActivityMs: number,
  nowMs: number,
  idleMinutes: number = SESSION_IDLE_MINUTES,
): boolean {
  if (!Number.isFinite(lastActivityMs)) return false;
  return nowMs - lastActivityMs > idleMinutes * 60_000;
}

/** Parse the raw cookie value into epoch ms, or NaN when absent/malformed. */
export function parseActivity(raw: string | undefined): number {
  if (!raw) return Number.NaN;
  return Number(raw);
}

/** Cookie options for the activity clock. */
export function activityCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}
