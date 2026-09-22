import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
  isIdleExpired,
  parseActivity,
} from "@/lib/session";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase auth session on every request and keeps cookies in
 * sync between the browser and server.
 *
 * Must return the same NextResponse whose cookies were mutated; returning a new
 * response would drop the refreshed cookies and log the user out intermittently.
 *
 * Also enforces the idle session timeout: if the gap since the last
 * authenticated request exceeds the window, the Supabase session is ended and
 * an `expired` flag is returned so the caller can redirect to the login screen.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not remove: getUser() validates the token and triggers the refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response, user, expired: false };
  }

  const now = Date.now();
  const lastActivity = parseActivity(request.cookies.get(ACTIVITY_COOKIE)?.value);

  if (isIdleExpired(lastActivity, now)) {
    // End the session server-side. signOut() removes the Supabase auth cookies
    // through the setAll handler above; we only clear our own clock cookie.
    await supabase.auth.signOut();
    response.cookies.delete(ACTIVITY_COOKIE);
    return { response, user: null, expired: true };
  }

  // Refresh the idle clock on any authenticated request.
  response.cookies.set(ACTIVITY_COOKIE, String(now), activityCookieOptions());

  return { response, user, expired: false };
}
