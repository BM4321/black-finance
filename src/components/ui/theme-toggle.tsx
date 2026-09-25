"use client";

import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import IconButton from "@mui/material/IconButton";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { useColorScheme } from "@mui/material/styles";
import type { MouseEvent } from "react";

import { THEME_ATTRIBUTE } from "@/theme/theme";

type Mode = "light" | "dark";

/** The scheme currently painted, read from the DOM (the source of truth). */
function currentMode(): Mode {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === "light"
    ? "light"
    : "dark";
}

/**
 * Switch theme, revealing the new one as a circle that grows from the point
 * that was clicked.
 *
 * Uses the View Transitions API: the browser snapshots the old page, we flip
 * the attribute, then animate a clip-path on the new snapshot. Browsers
 * without the API, and users who ask for reduced motion, get an instant
 * switch (the body colour still eases, see globals.css).
 */
function useThemeSwitch() {
  const { setMode } = useColorScheme();

  return (event: MouseEvent<HTMLElement>) => {
    const next: Mode = currentMode() === "dark" ? "light" : "dark";
    const apply = () => {
      // Flip the attribute synchronously so the snapshot shows the new theme;
      // setMode then persists the choice and keeps MUI in sync.
      document.documentElement.setAttribute(THEME_ATTRIBUTE, next);
      setMode(next);
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduceMotion) {
      apply();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = document.startViewTransition(apply);
    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 550,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {
        // The transition was skipped (e.g. the tab was hidden); the theme has
        // still been applied.
      });
  };
}

/** Sun and moon stacked; CSS swaps them with a rotate + scale. */
function ThemeIcon() {
  return (
    <span className="theme-icon" aria-hidden="true">
      <LightModeRounded className="icon-sun" sx={{ fontSize: 20 }} />
      <DarkModeRounded className="icon-moon" sx={{ fontSize: 20 }} />
    </span>
  );
}

/**
 * Light / dark theme toggle.
 *
 * `icon` renders a compact icon button (top bars, landing page); `row`
 * renders a navigation-style row with a label (sidebar, drawer). Neither
 * variant reads the theme during render, so server and client markup match.
 */
export function ThemeToggle({
  variant = "icon",
  labelClassName,
}: {
  variant?: "icon" | "row";
  labelClassName?: string;
}) {
  const toggle = useThemeSwitch();

  if (variant === "row") {
    return (
      <ListItemButton
        component="button"
        type="button"
        onClick={toggle}
        aria-label="Toggle light and dark theme"
        title="Toggle light and dark theme"
        sx={{ minHeight: 40, px: 1.5, gap: 1.5, width: "100%" }}
      >
        <ListItemIcon sx={{ minWidth: 0, color: "text.secondary" }}>
          <ThemeIcon />
        </ListItemIcon>
        <ListItemText
          className={labelClassName}
          primary={
            <>
              <span className="theme-label-light">Light mode</span>
              <span className="theme-label-dark">Dark mode</span>
            </>
          }
          slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }}
        />
      </ListItemButton>
    );
  }

  return (
    <IconButton
      onClick={toggle}
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
      sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
    >
      <ThemeIcon />
    </IconButton>
  );
}
