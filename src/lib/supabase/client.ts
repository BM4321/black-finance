import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client.
 *
 * Safe to expose: it only ever carries the publishable/anon key, and every
 * query is constrained by Row Level Security. Create one instance per call;
 * @supabase/ssr handles singleton behaviour internally.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
