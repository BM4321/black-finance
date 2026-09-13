import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for Server Components, Server Actions and Route
 * Handlers.
 *
 * Cookie writes can throw when called from a Server Component (they are
 * read-only in that context). We swallow that specific case: the middleware is
 * responsible for refreshing sessions, so a failed write there is harmless.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component. Middleware refreshes the session.
          }
        },
      },
    },
  );
}
