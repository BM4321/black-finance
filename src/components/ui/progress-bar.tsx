import LinearProgress from "@mui/material/LinearProgress";

export type ProgressTone = "primary" | "positive" | "warning" | "negative" | "neutral";

const TONE_COLOR: Record<ProgressTone, "primary" | "success" | "warning" | "error" | "secondary"> = {
  primary: "primary",
  positive: "success",
  warning: "warning",
  negative: "error",
  neutral: "secondary",
};

/**
 * Rounded progress bar, built on Material UI's LinearProgress.
 *
 * `value` is a percentage and is clamped to 0–100 so an overspent budget
 * fills the bar rather than overflowing it.
 */
export function ProgressBar({
  value,
  tone = "primary",
  label,
  className,
}: {
  value: number;
  tone?: ProgressTone;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <LinearProgress
      variant="determinate"
      value={clamped}
      color={TONE_COLOR[tone]}
      aria-label={label}
      className={className}
    />
  );
}
