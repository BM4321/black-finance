import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";
import { FormMessage } from "@/components/ui/form-message";
import { SESSION_IDLE_MINUTES } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; expired?: string }>;
}) {
  const { redirectTo, expired } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Pick up where you left off.
        </p>
      </div>

      {expired === "1" && (
        <FormMessage kind="notice">
          You were signed out after {SESSION_IDLE_MINUTES} minutes of inactivity.
        </FormMessage>
      )}

      <SignInForm redirectTo={redirectTo} />

      <p className="text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="font-medium text-primary">
          Create one
        </Link>
      </p>
    </div>
  );
}
