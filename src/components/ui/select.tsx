import type { SelectHTMLAttributes } from "react";

export function Select({
  className = "",
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary disabled:opacity-60 ${
        invalid ? "border-negative" : "border-border"
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
