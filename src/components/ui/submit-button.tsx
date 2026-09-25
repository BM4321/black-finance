"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonVariant } from "@/components/ui/button";

/**
 * Submit button that confirms before running a destructive Server Action.
 *
 * Uses `useFormStatus` so the button reflects the parent form's pending state
 * without the parent needing to be a client component.
 */
export function ConfirmSubmitButton({
  children,
  confirmText,
  variant = "danger",
  size,
  className,
}: {
  children: React.ReactNode;
  confirmText: string;
  variant?: ButtonVariant;
  size?: "small" | "medium" | "large";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </Button>
  );
}

/** Submit button that disables and shows pending text, no confirmation. */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  size?: "small" | "medium" | "large";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      loading={pending && !pendingText ? true : undefined}
      disabled={pending}
      className={className}
    >
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
