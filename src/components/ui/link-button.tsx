"use client";

import MuiButton, { type ButtonProps as MuiButtonProps } from "@mui/material/Button";
import Link from "next/link";

import { BUTTON_VARIANTS, type ButtonVariant } from "@/components/ui/button";

/**
 * A Material UI button that navigates with Next.js client-side routing.
 *
 * A client component because `component={Link}` passes a component reference,
 * which cannot cross the server/client boundary from a Server Component page.
 */
export function LinkButton({
  href,
  variant = "primary",
  ...props
}: Omit<MuiButtonProps<typeof Link>, "variant" | "color" | "component"> & {
  href: string;
  variant?: ButtonVariant;
}) {
  return (
    <MuiButton
      component={Link}
      href={href}
      {...BUTTON_VARIANTS[variant]}
      {...props}
    />
  );
}
