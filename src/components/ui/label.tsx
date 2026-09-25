import FormLabel from "@mui/material/FormLabel";
import type { LabelHTMLAttributes } from "react";

/** Field label, built on Material UI's FormLabel (renders a `<label>`). */
export function Label({
  className,
  htmlFor,
  children,
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <FormLabel
      htmlFor={htmlFor}
      className={className}
      sx={{
        display: "block",
        fontSize: 14,
        fontWeight: 500,
        color: "text.primary",
        "&.Mui-focused": { color: "text.primary" },
      }}
    >
      {children}
    </FormLabel>
  );
}
