import Typography from "@mui/material/Typography";
import Link from "next/link";

import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Typography component="h1" variant="h5">
          Create your account
        </Typography>
        <p className="text-sm text-muted-foreground">
          Start tracking your money in minutes.
        </p>
      </div>

      <SignUpForm />

      <p className="text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-primary">
          Sign in
        </Link>
      </p>
    </div>
  );
}
