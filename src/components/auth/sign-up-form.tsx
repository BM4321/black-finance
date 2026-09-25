"use client";

import { useActionState } from "react";

import { signUp, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialState);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.formError && <FormMessage kind="error">{state.formError}</FormMessage>}
      {state.formNotice && (
        <FormMessage kind="notice">{state.formNotice}</FormMessage>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Name</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          defaultValue={state.values?.fullName}
          invalid={Boolean(state.errors?.fullName)}
        />
        <FieldError messages={state.errors?.fullName} />
      </div>

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

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          invalid={Boolean(state.errors?.password)}
        />
        <FieldError messages={state.errors?.password} />
      </div>

      <Button type="submit" size="large" loading={pending} fullWidth>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
