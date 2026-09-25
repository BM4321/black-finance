import NativeSelect from "@mui/material/NativeSelect";
import OutlinedInput from "@mui/material/OutlinedInput";
import type { SelectHTMLAttributes } from "react";

/**
 * Select primitive: Material UI's NativeSelect in an outlined field.
 *
 * Native on purpose: it submits through FormData like a plain `<select>`, uses
 * the platform picker on phones, and keeps `<option>` children as the API.
 */
export function Select({
  className,
  invalid,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  ...native
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <NativeSelect
      fullWidth
      className={className}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      disabled={disabled}
      error={invalid}
      input={<OutlinedInput size="small" />}
      inputProps={{ "aria-invalid": invalid || undefined, ...native }}
    >
      {children}
    </NativeSelect>
  );
}
