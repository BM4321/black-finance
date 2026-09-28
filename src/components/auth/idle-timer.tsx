"use client";

import AccessTimeRounded from "@mui/icons-material/AccessTimeRounded";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { endIdleSession, signOut, touchSession } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { idlePhase } from "@/lib/session";

/** How long before sign-out the warning appears. */
const WARNING_MS = 60_000;
/** At most one keep-alive request per this interval while the user is active. */
const KEEP_ALIVE_MS = 5 * 60_000;
/** Activity is written for other tabs at most this often. */
const SHARE_THROTTLE_MS = 5_000;
/** Shared across tabs, so activity in one tab keeps the others signed in. */
const STORAGE_KEY = "bf-idle-activity";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const;

function readShared(): number {
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeShared(value: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Private mode / blocked storage: tabs just time out independently.
  }
}

/**
 * Client-side idle timeout.
 *
 * The server enforces the idle window on the next request, but a page left
 * open would otherwise keep showing financial data indefinitely. This timer
 * watches for real interaction (pointer, keyboard, scroll, touch), warns a
 * minute before the window ends, and then signs the user out and shows the
 * login screen with the timeout notice.
 *
 * While the user is active it also pings the server now and then, so the
 * server-side window tracks the same activity instead of only page loads.
 * Activity is shared between tabs through localStorage.
 */
export function IdleTimer({ idleMinutes }: { idleMinutes: number }) {
  const pathname = usePathname();
  const lastActivity = useRef(0);
  const lastShared = useRef(0);
  const lastPing = useRef(0);
  const signingOut = useRef(false);
  const warningRef = useRef(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const markActive = useCallback((now = Date.now()) => {
    lastActivity.current = now;
    if (now - lastShared.current > SHARE_THROTTLE_MS) {
      lastShared.current = now;
      writeShared(now);
    }
    if (now - lastPing.current > KEEP_ALIVE_MS) {
      lastPing.current = now;
      void touchSession().catch(() => {
        // Offline: the next successful request refreshes the clock anyway.
      });
    }
  }, []);

  const staySignedIn = useCallback(() => {
    warningRef.current = false;
    setRemainingMs(null);
    lastPing.current = 0; // force a keep-alive so the server clock resets too
    markActive();
  }, [markActive]);

  useEffect(() => {
    const now = Date.now();
    lastActivity.current = Math.max(now, readShared());
    lastPing.current = now; // this page load already refreshed the server clock

    function onActivity() {
      // Once the warning is up, only an explicit "Stay signed in" counts, so a
      // stray mouse movement cannot silently dismiss it.
      if (!warningRef.current) markActive();
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      const shared = Number(event.newValue);
      if (shared > lastActivity.current) {
        lastActivity.current = shared;
        if (warningRef.current) {
          warningRef.current = false;
          setRemainingMs(null);
        }
      }
    }

    function check() {
      if (signingOut.current) return;
      const latest = Math.max(lastActivity.current, readShared());
      lastActivity.current = latest;
      const state = idlePhase(latest, Date.now(), idleMinutes, WARNING_MS);

      if (state.phase === "expired") {
        signingOut.current = true;
        void endIdleSession(pathname);
        return;
      }
      if (state.phase === "warning") {
        warningRef.current = true;
        // Update once per second for the countdown.
        setRemainingMs(Math.ceil(state.remainingMs / 1000) * 1000);
      } else if (warningRef.current) {
        warningRef.current = false;
        setRemainingMs(null);
      }
    }

    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, onActivity, { passive: true });
    }
    window.addEventListener("storage", onStorage);
    // Background tabs throttle timers; re-check as soon as the tab is visible.
    document.addEventListener("visibilitychange", check);
    const interval = window.setInterval(check, 1000);

    return () => {
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, onActivity);
      }
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(interval);
    };
  }, [idleMinutes, markActive, pathname]);

  const open = remainingMs !== null;
  const seconds = Math.ceil((remainingMs ?? 0) / 1000);

  return (
    <Dialog
      open={open}
      onClose={staySignedIn}
      aria-labelledby="idle-title"
      aria-describedby="idle-description"
      slotProps={{ paper: { sx: { borderRadius: "20px", maxWidth: 400 } } }}
    >
      <DialogTitle id="idle-title" sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <AccessTimeRounded fontSize="small" />
        </span>
        Still there?
      </DialogTitle>
      <DialogContent>
        <Typography id="idle-description" variant="body2" color="text.secondary">
          For your security, you’ll be signed out in{" "}
          <strong className="tabular-nums text-foreground">{seconds}s</strong>{" "}
          because there’s been no activity for a while.
        </Typography>
        <LinearProgress
          variant="determinate"
          value={(seconds / (WARNING_MS / 1000)) * 100}
          aria-hidden="true"
          sx={{ mt: 2.5, "& .MuiLinearProgress-bar": { transition: "transform 1s linear" } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <form action={signOut}>
          <Button type="submit" variant="ghost">
            Sign out now
          </Button>
        </form>
        <Button onClick={staySignedIn} autoFocus>
          Stay signed in
        </Button>
      </DialogActions>
    </Dialog>
  );
}
