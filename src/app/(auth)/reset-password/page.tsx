import Typography from "@mui/material/Typography";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { FormMessage } from "@/components/ui/form-message";
import { getUser } from "@/lib/auth";

export const metadata = { title: "Choose a new password" };

/**
 * Where the password reset email lands (via /auth/confirm, which signs the
 * user in for the reset). Without that session the link has expired or was
 * already used, so we offer to send a new one instead of a form that would
 * fail.
 */
export default async function ResetPasswordPage() {
  const user = await getUser();

  if (!user) {
    return (
      <div className="space-y-6">
        <Typography component="h1" variant="h5">
          Link expired
        </Typography>
        <FormMessage kind="error">
          This password reset link has expired or was already used.
        </FormMessage>
        <p className="text-sm text-muted-foreground">
          <Link href="/forgot-password" className="font-medium text-primary">
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Typography component="h1" variant="h5">
          Choose a new password
        </Typography>
        <p className="text-sm text-muted-foreground">
          For <span className="font-medium text-foreground">{user.email}</span>. You’ll
          stay signed in afterwards.
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}
