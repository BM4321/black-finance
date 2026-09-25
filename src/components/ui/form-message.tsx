import Alert from "@mui/material/Alert";
import FormHelperText from "@mui/material/FormHelperText";
import type { ReactNode } from "react";

/**
 * Inline form message, built on Material UI's Alert. `role="alert"` makes
 * errors announced immediately when they appear; notices use the politer
 * `status` role.
 */
export function FormMessage({
  kind,
  children,
}: {
  kind: "error" | "notice";
  children: ReactNode;
}) {
  return (
    <Alert
      variant="outlined"
      severity={kind === "error" ? "error" : "info"}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </Alert>
  );
}

/** Field-level validation error text. */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <FormHelperText error role="alert" sx={{ mx: 0 }}>
      {messages[0]}
    </FormHelperText>
  );
}
