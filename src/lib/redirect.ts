/**
 * Restrict post-login redirects to internal paths.
 *
 * Without this, `?redirectTo=https://evil.com` would send a freshly
 * authenticated user to an attacker-controlled site (an open redirect), which
 * is commonly chained with phishing. We only allow single-slash, relative
 * paths; protocol-relative `//host` and absolute URLs are rejected.
 */
export function safeRedirect(
  target: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!target) return fallback;
  if (!target.startsWith("/")) return fallback;
  if (target.startsWith("//")) return fallback;
  if (target.startsWith("/\\")) return fallback; // browsers treat /\ as //
  return target;
}
