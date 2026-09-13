import type { ReactNode } from "react";

/**
 * Inline form message. `role="alert"` makes errors announced immediately when
 * they appear; notices use the politer `status` role.
 */
export function FormMessage({
  kind,
  children,
}: {
  kind: "error" | "notice";
  children: ReactNode;
}) {
  const palette =
    kind === "error"
      ? "border-negative/30 bg-negative/5 text-negative"
      : "border-primary/30 bg-primary/5 text-primary";
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${palette}`}
    >
      {children}
    </p>
  );
}

/** Field-level validation error text. */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p role="alert" className="text-xs text-negative">
      {messages[0]}
    </p>
  );
}
