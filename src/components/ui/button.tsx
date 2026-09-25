import MuiButton, { type ButtonProps as MuiButtonProps } from "@mui/material/Button";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** App variants mapped onto Material UI's variant + colour pairs. */
export const BUTTON_VARIANTS: Record<
  ButtonVariant,
  Pick<MuiButtonProps, "variant" | "color">
> = {
  primary: { variant: "contained", color: "primary" },
  secondary: { variant: "outlined", color: "secondary" },
  ghost: { variant: "text", color: "inherit" },
  danger: { variant: "outlined", color: "error" },
};

/**
 * Button primitive, built on Material UI.
 *
 * Keeps the app's small variant vocabulary so call sites stay readable, and
 * defaults `type` to "button" so a button inside a form never submits by
 * accident.
 */
export function Button({
  variant = "primary",
  type = "button",
  ...props
}: Omit<MuiButtonProps, "variant" | "color"> & { variant?: ButtonVariant }) {
  return <MuiButton type={type} {...BUTTON_VARIANTS[variant]} {...props} />;
}
