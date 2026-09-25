import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

const TONE_COLOR = {
  neutral: "text.primary",
  positive: "success.main",
  negative: "error.main",
  muted: "text.secondary",
} as const;

/** A single headline figure: label, value and an optional hint line. */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  size = "medium",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: keyof typeof TONE_COLOR;
  size?: "medium" | "large";
  className?: string;
}) {
  return (
    <Card className={`hover-lift ${className ?? ""}`} sx={{ px: 2.5, py: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="p"
        sx={{
          mt: 0.5,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          fontSize: size === "large" ? { xs: 32, sm: 40 } : 22,
          lineHeight: 1.15,
          color: TONE_COLOR[tone],
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
          {hint}
        </Typography>
      )}
    </Card>
  );
}
