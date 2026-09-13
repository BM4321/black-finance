import type { TextareaHTMLAttributes } from "react";

export function Textarea({
  className = "",
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:opacity-60 ${
        invalid ? "border-negative" : "border-border"
      } ${className}`}
      {...props}
    />
  );
}
