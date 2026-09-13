import type { InputHTMLAttributes } from "react";

/**
 * Text input primitive.
 *
 * Owned rather than pulled from a component library: the styling surface is
 * small enough that a dependency would cost more than it saves. `aria-invalid`
 * is set automatically so screen readers announce validation failures.
 */
export function Input({
  className = "",
  invalid,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      id={id}
      aria-invalid={invalid || undefined}
      className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:opacity-60 ${
        invalid ? "border-negative" : "border-border"
      } ${className}`}
      {...props}
    />
  );
}
