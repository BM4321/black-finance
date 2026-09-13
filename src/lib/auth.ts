import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Returns the authenticated user, or null.
 *
 * Authorization must never rely on the proxy redirect alone: proxy can be
 * bypassed for Server Function calls on excluded paths, so every protected
 * server entry point re-checks here.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns the authenticated user or redirects to /login. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
