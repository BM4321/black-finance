"use client";

import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import Fab from "@mui/material/Fab";
import Grow from "@mui/material/Grow";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState } from "react";

import { AssistantChat } from "@/components/assistant/assistant-chat";

/**
 * Floating assistant launcher.
 *
 * A Material UI extended FAB pinned to the bottom-right of every authenticated
 * page. It opens a chat panel above itself. Kept as a client component because
 * the open state and conversation are per-session UI state.
 *
 * The conversation lives inside the panel, so it persists while the page
 * underneath changes (the panel is mounted in the app layout, not per page).
 * The panel stays mounted while closed (hidden), so the conversation also
 * survives closing and reopening during the session.
 */
export function AssistantLauncher({ configured }: { configured: boolean }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape, matching standard dialog behaviour.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Panel ---------------------------------------------------------- */}
      <Grow in={open} style={{ transformOrigin: "bottom right" }}>
        <Paper
          role="dialog"
          aria-label="Financial assistant"
          aria-hidden={!open}
          variant="outlined"
          sx={{
            position: "fixed",
            zIndex: 1300,
            bottom: 88,
            left: { xs: 12, sm: "auto" },
            right: { xs: 12, sm: 24 },
            width: { sm: 420 },
            height: "min(70vh, 560px)",
            display: open ? "flex" : "none",
            flexDirection: "column",
            p: 2,
            borderRadius: "24px",
            bgcolor: "background.default",
            boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
          }}
        >
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <AutoAwesomeRounded fontSize="small" />
              </span>
              <div>
                <Typography component="h2" variant="subtitle2">
                  Financial assistant
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Grounded in your own data
                </Typography>
              </div>
            </div>
            <IconButton size="small" onClick={() => setOpen(false)} aria-label="Close assistant">
              <CloseRounded fontSize="small" />
            </IconButton>
          </div>

          <div className="min-h-0 flex-1">
            <AssistantChat configured={configured} />
          </div>
        </Paper>
      </Grow>

      {/* Launcher ------------------------------------------------------- */}
      <Fab
        ref={buttonRef}
        variant="extended"
        color="primary"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close financial assistant" : "Open financial assistant"}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1300,
          gap: 1,
          textTransform: "none",
          fontWeight: 600,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
        }}
      >
        {open ? <CloseRounded /> : <AutoAwesomeRounded />}
        <span className="hidden sm:inline">{open ? "Close" : "Ask AI"}</span>
      </Fab>
    </>
  );
}
