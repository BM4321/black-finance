"use client";

import { useActionState } from "react";

import { requestPasswordReset, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.formError && <FormMessage kind="error">{state.formError}</FormMessage>}
      {state.formNotice && <FormMessage kind="notice">{state.formNotice}</FormMessage>}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          invalid={Boolean(state.errors?.email)}
        />
        <FieldError messages={state.errors?.email} />
      </div>

      <Button type="submit" size="large" loading={pending} fullWidth>
        {state.formNotice ? "Send again" : "Send reset link"}
      </Button>
    </form>
  );
}
