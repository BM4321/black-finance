import Typography from "@mui/material/Typography";
import { cookies } from "next/headers";

import {
  FragmentLinkProblem,
  ResetLinkProblemNotice,
  ResetPasswordForm,
  ResetPasswordSuccess,
} from "@/components/auth/reset-password-form";
import { LinkButton } from "@/components/ui/link-button";
import { FormMessage } from "@/components/ui/form-message";
import { getUser } from "@/lib/auth";
import {
  isRecoveryFor,
  RECOVERY_COOKIE,
  RESET_DONE_COOKIE,
  resetLinkProblem,
} from "@/lib/auth/recovery";

export const metadata = { title: "Reset your password" };

/**
 * Where a password reset email lands.
 *
 * The proxy has already traded the link's one-time code for a recovery
 * session (via /auth/confirm) before this renders. The form is shown only
 * with that session *and* its recovery marker; otherwise the page explains
 * what went wrong and offers a new link, so an expired link or a merely
 * signed-in visitor never gets a form that would fail or bypass the email.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }
  const problem = resetLinkProblem(params);

  const header = (
    <div className="space-y-1">
      <Typography component="h1" variant="h5">
        Reset your password
      </Typography>
    </div>
  );

  const cookieStore = await cookies();

  // Just changed: the action signed every session out and left a brief flash.
  if (params.get("updated") === "1" && cookieStore.get(RESET_DONE_COOKIE)) {
    return (
      <div className="space-y-6">
        {header}
        <ResetPasswordSuccess />
      </div>
    );
  }

  if (problem) {
    return (
      <div className="space-y-6">
        {header}
        <ResetLinkProblemNotice problem={problem} />
      </div>
    );
  }

  const user = await getUser();
  if (!user) {
    return (
      <div className="space-y-6">
        {header}
        <ResetLinkProblemNotice problem="expired" />
      </div>
    );
  }

  if (!isRecoveryFor(cookieStore.get(RECOVERY_COOKIE)?.value, user.id)) {
    return (
      <div className="space-y-6">
        {header}
        <FormMessage kind="notice">
          To change your password, open the link in the reset email we send you. It
          proves the request came from your inbox.
        </FormMessage>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/forgot-password">Email me a reset link</LinkButton>
          <LinkButton href="/dashboard" variant="secondary">
            Back to the app
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Typography component="h1" variant="h5">
          Reset your password
        </Typography>
        <p className="text-sm text-muted-foreground">
          Choose a new password for{" "}
          <span className="font-medium text-foreground">{user.email}</span>.
        </p>
      </div>

      <FragmentLinkProblem />
      <ResetPasswordForm />
    </div>
  );
}
