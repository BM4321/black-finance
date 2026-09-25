import Chip from "@mui/material/Chip";

export type BadgeTone = "positive" | "negative" | "primary" | "warning" | "neutral";

const TONE_COLOR: Record<BadgeTone, "success" | "error" | "primary" | "warning" | "default"> = {
  positive: "success",
  negative: "error",
  primary: "primary",
  warning: "warning",
  neutral: "default",
};

/** Small status label, built on Material UI's Chip. */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: BadgeTone;
}) {
  return (
    <Chip
      label={children}
      size="small"
      variant="outlined"
      color={TONE_COLOR[tone]}
      sx={{
        height: 20,
        fontSize: 10,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        "& .MuiChip-label": { px: 0.75 },
      }}
    />
  );
}
