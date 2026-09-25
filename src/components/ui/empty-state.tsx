import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

/**
 * Empty state.
 *
 * Good empty states tell the user what this area is for and how to start,
 * rather than showing a blank panel.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderStyle: "dashed",
        borderRadius: "20px",
        px: 3,
        py: 6,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 1,
      }}
    >
      <Typography component="h2" variant="h6">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
          {description}
        </Typography>
      )}
      {action && <div className="mt-3">{action}</div>}
    </Paper>
  );
}
