import OutlinedInput from "@mui/material/OutlinedInput";
import type { InputHTMLAttributes, Ref } from "react";

/**
 * Text input primitive, built on Material UI's OutlinedInput.
 *
 * Accepts plain `<input>` attributes so forms keep their native `name` /
 * `defaultValue` wiring to Server Actions. Attributes MUI manages itself are
 * passed at the top level; everything else lands on the native element.
 * `aria-invalid` is set automatically so screen readers announce failures.
 */
export function Input({
  className,
  invalid,
  id,
  name,
  type,
  value,
  defaultValue,
  onChange,
  placeholder,
  required,
  disabled,
  autoComplete,
  autoFocus,
  readOnly,
  ref,
  ...native
}: InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  /** Reaches the native <input> (React 19 passes refs as props). */
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <OutlinedInput
      fullWidth
      size="small"
      className={className}
      id={id}
      name={name}
      type={type}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      readOnly={readOnly}
      error={invalid}
      inputRef={ref}
      inputProps={{ "aria-invalid": invalid || undefined, ...native }}
    />
  );
}
