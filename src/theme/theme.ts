
import { alpha, createTheme } from "@mui/material/styles";

/**
 * Black Finance Material UI theme.
 *
 * The hex values mirror the CSS tokens in `globals.css` so Tailwind utilities
 * and MUI components paint the same palette. Change a colour in both places.
 * Rounded geometry throughout: nothing in the system has a sharp corner.
 */

export const tokens = {
  background: "#0b0c0e",
  surface: "#141518",
  surfaceMuted: "#1c1d21",
  border: "#25272c",
  foreground: "#eceae4",
  muted: "#a8a59c",
  primary: "#d8b76e",
  primaryForeground: "#14130f",
  positive: "#7fd3a4",
  negative: "#f08a74",
  warning: "#e6b450",
} as const;

/**
 * Chart series colours. They step in lightness as well as hue, so adjacent
 * series stay distinguishable in greyscale and for colour-blind users.
 */
export const CHART_COLORS = [
  "#d8b76e",
  "#eceae4",
  "#6e8ca8",
  "#9c7b3c",
  "#8fb8a0",
  "#b58db6",
  "#5d6168",
  "#e0a080",
] as const;

export const theme = createTheme({
  palette: {
    mode: "dark",
    background: { default: tokens.background, paper: tokens.surface },
    primary: { main: tokens.primary, contrastText: tokens.primaryForeground },
    secondary: { main: tokens.foreground, contrastText: tokens.background },
    success: { main: tokens.positive, contrastText: tokens.primaryForeground },
    error: { main: tokens.negative, contrastText: tokens.primaryForeground },
    warning: { main: tokens.warning, contrastText: tokens.primaryForeground },
    info: { main: "#8fb3d9", contrastText: tokens.primaryForeground },
    text: { primary: tokens.foreground, secondary: tokens.muted },
    divider: tokens.border,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
    h1: { fontWeight: 600, letterSpacing: "-0.03em" },
    h2: { fontWeight: 600, letterSpacing: "-0.025em" },
    h3: { fontWeight: 600, letterSpacing: "-0.02em" },
    h4: { fontWeight: 600, letterSpacing: "-0.02em" },
    h5: { fontWeight: 600, letterSpacing: "-0.01em" },
    h6: { fontWeight: 600, fontSize: "0.95rem" },
    overline: {
      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      letterSpacing: "0.12em",
      lineHeight: 1.6,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontVariantNumeric: "tabular-nums" },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: {
          borderRadius: 16,
          borderColor: tokens.border,
          backgroundColor: tokens.surface,
          transition: "border-color 160ms ease, box-shadow 160ms ease",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 16, minHeight: 40 },
        sizeSmall: { minHeight: 32, paddingInline: 10, borderRadius: 8 },
        outlined: { borderColor: tokens.border },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: tokens.background,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.border },
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 8,
          borderRadius: 999,
          backgroundColor: tokens.surfaceMuted,
        },
        bar: { borderRadius: 999 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: 0,
          borderRadius: 8,
          paddingBlock: 4,
          paddingInline: 12,
          textTransform: "none",
          fontWeight: 500,
          "&.Mui-selected": {
            backgroundColor: tokens.border,
            color: tokens.foreground,
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          gap: 2,
          padding: 3,
          borderRadius: 10,
          backgroundColor: tokens.background,
          border: `1px solid ${tokens.border}`,
        },
        grouped: { borderRadius: "8px !important", border: 0 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          "&.Mui-selected": {
            backgroundColor: alpha(tokens.primary, 0.12),
            color: tokens.primary,
            "& .MuiListItemIcon-root": { color: tokens.primary },
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: "#0f1013", borderColor: tokens.border },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: 8, backgroundColor: tokens.surfaceMuted },
      },
    },
  },
});
