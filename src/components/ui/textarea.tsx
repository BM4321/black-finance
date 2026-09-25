import OutlinedInput from "@mui/material/OutlinedInput";
import type { TextareaHTMLAttributes } from "react";

/** Multi-line text input, built on Material UI's OutlinedInput. */
export function Textarea({
  className,
  invalid,
  id,
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  required,
  disabled,
  rows = 3,
  ...native
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <OutlinedInput
      fullWidth
      multiline
      size="small"
      minRows={rows}
      className={className}
      id={id}
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      error={invalid}
      inputProps={{ "aria-invalid": invalid || undefined, ...native }}
    />
  );
}
