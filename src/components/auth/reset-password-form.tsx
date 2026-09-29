"use client";

import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import { useActionState, useEffect, useRef, useState } from "react";

import { updatePassword, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { resetLinkProblem, type ResetLinkProblem } from "@/lib/auth/recovery";

const initialState: AuthActionState = {};

/** Mirrors resetPasswordSchema (lib/validation/auth.ts), for live feedback. */
const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

type Checks = { long: boolean; notTooLong: boolean; matches: boolean };

function Requirement({ met, children }: { met: boolean; children: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? "text-positive" : "text-muted-foreground"}`}>
      {met ? (
        <CheckCircleRounded sx={{ fontSize: 16 }} aria-hidden="true" />
      ) : (
        <RadioButtonUncheckedRounded sx={{ fontSize: 16 }} aria-hidden="true" />
      )}
      <span>
        {children}
        <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>
      </span>
    </li>
  );
}

/**
 * New-password form for a recovery session.
 *
 * The inputs are uncontrolled: the password lives only in the DOM field and
 * the submitted form data, never in React state. Live feedback keeps just
 * true/false flags. After a successful save the action signs the account
 * out everywhere and the page shows ResetPasswordSuccess.
 */
export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [checks, setChecks] = useState<Checks>({
    long: false,
    notTooLong: true,
    matches: false,
  });

  function recheck() {
    const password = passwordRef.current?.value ?? "";
    const confirm = confirmRef.current?.value ?? "";
    setChecks({
      long: password.length >= MIN_LENGTH,
      notTooLong: password.length <= MAX_LENGTH,
      matches: password.length > 0 && password === confirm,
    });
  }

  const ready = checks.long && checks.notTooLong && checks.matches;

  return (
    <form action={action} onInput={recheck} className="space-y-4" noValidate>
      {state.formError && <FormMessage kind="error">{state.formError}</FormMessage>}

      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(state.errors?.password)}
        />
        <FieldError messages={state.errors?.password} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          ref={confirmRef}
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(state.errors?.confirmPassword)}
        />
        <FieldError messages={state.errors?.confirmPassword} />
      </div>

      <ul className="space-y-1 text-sm" aria-live="polite">
        <Requirement met={checks.long}>At least 8 characters</Requirement>
        {!checks.notTooLong && (
          <Requirement met={false}>At most 72 characters</Requirement>
        )}
        <Requirement met={checks.matches}>Both passwords match</Requirement>
      </ul>

      <Button type="submit" size="large" loading={pending} disabled={pending || !ready} fullWidth>
        Update password
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <LinkButton href="/login" variant="ghost" size="small">
          Back to sign in
        </LinkButton>
      </p>
    </form>
  );
}

/** Shown after the password has been changed and every session signed out. */
export function ResetPasswordSuccess() {
  return (
    <div className="animate-scale-in space-y-5 text-center" role="status">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-positive/10 text-positive">
        <CheckCircleRounded sx={{ fontSize: 32 }} aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-lg font-semibold">Password updated</p>
        <p className="text-sm text-muted-foreground">
          For your security you’ve been signed out on all devices. Sign in with your
          new password.
        </p>
      </div>
      <LinkButton href="/login?reset=success" size="large" fullWidth>
        Sign in
      </LinkButton>
    </div>
  );
}

const PROBLEM_TEXT: Record<ResetLinkProblem, string> = {
  expired: "This reset link has expired or was already used.",
  invalid: "This reset link isn’t valid. It may have been copied incompletely.",
};

/**
 * Explains a failed reset link and offers a new one.
 *
 * Also used on the page's normal path to catch errors Supabase puts in the
 * URL fragment (`#error_code=otp_expired`), which the server never sees.
 */
export function ResetLinkProblemNotice({ problem }: { problem: ResetLinkProblem }) {
  return (
    <div className="space-y-4">
      <FormMessage kind="error">
        {PROBLEM_TEXT[problem]} Reset links work once and expire after a short time.
      </FormMessage>
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/forgot-password">Send a new link</LinkButton>
        <LinkButton href="/login" variant="secondary">
          Back to sign in
        </LinkButton>
      </div>
    </div>
  );
}

/**
 * Shows the problem notice when Supabase reported a failed link in the URL
 * fragment. Renders nothing otherwise.
 */
export function FragmentLinkProblem() {
  const [problem, setProblem] = useState<ResetLinkProblem | null>(null);
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const found = resetLinkProblem(new URLSearchParams(hash));
    if (!found) return;
    // Remove the fragment so it does not linger in history.
    window.history.replaceState(null, "", window.location.pathname);
    const frame = requestAnimationFrame(() => setProblem(found));
    return () => cancelAnimationFrame(frame);
  }, []);
  return problem ? <ResetLinkProblemNotice problem={problem} /> : null;
}
