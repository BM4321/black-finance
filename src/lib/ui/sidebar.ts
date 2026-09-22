/**
 * Sidebar collapse preference.
 *
 * Stored in a cookie rather than localStorage so the server can render the
 * correct initial width. That avoids the "expand, then snap to collapsed"
 * flicker (and the hydration mismatch) you get when the preference is only
 * known on the client.
 */

export const SIDEBAR_COOKIE = "bf_sidebar_collapsed";

/** Parse the cookie value into a boolean; anything else means expanded. */
export function parseSidebarCollapsed(value: string | undefined): boolean {
  return value === "true";
}

/** Cookie attributes for the preference. Long-lived and not HTTP-only (the
 * client writes it on toggle). */
export const SIDEBAR_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};
