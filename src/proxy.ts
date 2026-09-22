import { NextResponse, type NextRequest } from "next/server";

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
const AUTH_ROUTES = ["/login", "/signup"];

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

export async function proxy(request: NextRequest) {
  const { response, user, expired } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // The idle timeout fired: send the user to sign in with an explanation, and
  // remember where they were so they can pick up where they left off.
  if (expired && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("expired", "1");
    if (isProtected) url.searchParams.set("redirectTo", pathname);
    return redirectWithCookies(url, response);
  }

  if (isProtected && !user) {
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
