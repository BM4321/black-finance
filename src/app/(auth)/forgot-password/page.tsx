import Typography from "@mui/material/Typography";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { FormMessage } from "@/components/ui/form-message";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  const { link } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Typography component="h1" variant="h5">
          Reset your password
        </Typography>
        <p className="text-sm text-muted-foreground">
          Enter the email you signed up with and we’ll send you a link to choose a new
          password.
        </p>
      </div>

      {link === "expired" && (
        <FormMessage kind="error">
          That reset link has expired or was already used. Request a new one below.
        </FormMessage>
      )}

      <ForgotPasswordForm />

      <p className="text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
