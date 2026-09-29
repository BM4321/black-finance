import { NextResponse, type NextRequest } from "next/server";

import { RESET_PASSWORD_PATH } from "@/lib/auth/recovery";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js Proxy (formerly Middleware in Next 15 and earlier).
 *
 * This performs an *optimistic* auth check: it refreshes the Supabase session
 * and redirects obviously-unauthenticated traffic away from app routes. It is
 * NOT the security boundary. Server Actions, route handlers and, above all,
 * Postgres Row Level Security enforce real authorization. See:
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
 */

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/accounts",
  "/transactions",
  "/budgets",
  "/goals",
  "/investments",
  "/debts",
  "/reports",
];
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

/**
 * Build a redirect that preserves the cookies `updateSession` set on the
 * original response.
 *
 * This is essential: the refreshed Supabase auth cookies (and the idle-clock
 * cookie) live on `response`. A bare `NextResponse.redirect()` would drop them
 * and log the user out intermittently.
 */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

/**
 * A password reset email returns to /reset-password carrying a one-time
 * `code` (PKCE) or `token_hash` (custom email template). Hand it to
 * /auth/confirm, which exchanges it for a recovery session and comes back to
 * a clean /reset-password, so the code never stays in the address bar or
 * history. Supabase's own error parameters are left for the page to show.
 */
function forwardRecoveryLink(request: NextRequest): NextResponse | null {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname !== RESET_PASSWORD_PATH) return null;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  if (!code && !tokenHash) return null;

  const url = request.nextUrl.clone();
  url.pathname = "/auth/confirm";
  url.search = "";
  if (tokenHash) {
    url.searchParams.set("token_hash", tokenHash);
    url.searchParams.set("type", "recovery");
  } else if (code) {
    url.searchParams.set("code", code);
  }
  url.searchParams.set("next", RESET_PASSWORD_PATH);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const forwarded = forwardRecoveryLink(request);
  if (forwarded) return forwarded;

  const { response, user, expired } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Server Action requests are left to the action itself: every action
  // re-checks the user (requireUser) and redirects through the action
  // protocol. A proxy redirect on an action POST cannot be followed as one.
  const isServerAction = request.headers.has("next-action");

  // The idle timeout fired on a protected page: send the user to sign in with
  // an explanation, and remember where they were so they can pick up where
  // they left off. Public pages (the landing page) simply render signed out.
  if (expired && isProtected && !isServerAction) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("expired", "1");
    url.searchParams.set("redirectTo", pathname);
    return redirectWithCookies(url, response);
  }

  if (isProtected && !user && !isServerAction) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirectTo", pathname);
    return redirectWithCookies(url, response);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image optimisation so the
     * session cookie stays fresh without processing asset requests.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
