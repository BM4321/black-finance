"use client";

import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

/**
 * Sign-out is a form POST, not a link.
 *
 * A GET link to a sign-out endpoint is vulnerable to being triggered by an
 * <img> tag or prefetcher on another site. A Server Action POST requires a
 * same-origin form submission.
 */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" className="px-2 py-1.5 text-xs">
        Sign out
      </Button>
    </form>
  );
}
