import { createTheme } from "@mui/material/styles";

/**
 * Black Finance Material UI theme, with light and dark colour schemes.
 *
 * The scheme is chosen by a `data-theme` attribute on <html>, which MUI's
 * InitColorSchemeScript sets before first paint (no flash of the wrong
 * theme). The same attribute switches the CSS tokens in `globals.css`, so
 * Tailwind utilities and MUI components always agree. Component overrides use
 * those CSS variables, which means they follow the scheme with no JS.
 *
 * Keep the hex values here in step with `globals.css`.
 */

export const THEME_ATTRIBUTE = "data-theme";
export const THEME_STORAGE_KEY = "bf-theme";
export const DEFAULT_THEME_MODE = "dark";

export type SchemeTokens = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  foreground: string;
  muted: string;
  primary: string;
  primaryForeground: string;
  positive: string;
  negative: string;
  warning: string;
  /** Categorical chart series; they step in lightness as well as hue. */
  chart: readonly string[];
};

export const SCHEMES: Record<"light" | "dark", SchemeTokens> = {
  dark: {
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
    chart: ["#d8b76e", "#eceae4", "#6e8ca8", "#9c7b3c", "#8fb8a0", "#b58db6", "#5d6168", "#e0a080"],
  },
  light: {
    background: "#f6f5f1",
    surface: "#ffffff",
    surfaceMuted: "#efede7",
    border: "#e2dfd6",
    foreground: "#141413",
    muted: "#6b675e",
    primary: "#8a6a26",
    primaryForeground: "#ffffff",
    positive: "#1d7a4b",
    negative: "#b4432c",
    warning: "#9a6a12",
    chart: ["#8a6a26", "#2f2e2a", "#4f6f8c", "#c9a55a", "#4d8a68", "#8c5f8e", "#a39f97", "#c07650"],
  },
};

function palette(tokens: SchemeTokens) {
  return {
    background: { default: tokens.background, paper: tokens.surface },
    primary: { main: tokens.primary, contrastText: tokens.primaryForeground },
    secondary: { main: tokens.foreground, contrastText: tokens.background },
    success: { main: tokens.positive, contrastText: tokens.primaryForeground },
    error: { main: tokens.negative, contrastText: tokens.primaryForeground },
    warning: { main: tokens.warning, contrastText: tokens.primaryForeground },
    text: { primary: tokens.foreground, secondary: tokens.muted },
    divider: tokens.border,
  };
}

/** Shared easing so every motion in the app moves with the same feel. */
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: THEME_ATTRIBUTE },
  colorSchemes: {
    dark: { palette: palette(SCHEMES.dark) },
    light: { palette: palette(SCHEMES.light) },
  },
  defaultColorScheme: DEFAULT_THEME_MODE,
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
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
          transition: `border-color 200ms ease, box-shadow 250ms ease, transform 250ms ${EASE_OUT}`,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingInline: 16,
          minHeight: 40,
          transition: `background-color 200ms ease, border-color 200ms ease, color 200ms ease, transform 150ms ${EASE_OUT}`,
          "&:active": { transform: "scale(0.97)" },
        },
        sizeSmall: { minHeight: 32, paddingInline: 10, borderRadius: 8 },
        outlined: { borderColor: "var(--border)" },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: `background-color 200ms ease, transform 150ms ${EASE_OUT}`,
          "&:active": { transform: "scale(0.92)" },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          transition: `transform 200ms ${EASE_OUT}, box-shadow 200ms ease`,
          "&:hover": { transform: "translateY(-2px)" },
          "&:active": { transform: "scale(0.96)" },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: "var(--background)",
          transition: "box-shadow 200ms ease",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--border)",
            transition: "border-color 200ms ease",
          },
          "&.Mui-focused": {
            boxShadow: "0 0 0 4px color-mix(in srgb, var(--primary) 18%, transparent)",
          },
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
          backgroundColor: "var(--surface-muted)",
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
          transition: "background-color 200ms ease, color 200ms ease",
          "&.Mui-selected": {
            backgroundColor: "var(--surface)",
            color: "var(--foreground)",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.18)",
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
          backgroundColor: "var(--surface-muted)",
          border: "1px solid var(--border)",
        },
        grouped: { borderRadius: "8px !important", border: 0 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: "background-color 200ms ease, color 200ms ease",
          "& .MuiListItemIcon-root": {
            transition: `transform 250ms ${EASE_OUT}, color 200ms ease`,
          },
          "&:hover .MuiListItemIcon-root": { transform: "translateX(2px)" },
          "&.Mui-selected": {
            backgroundColor: "color-mix(in srgb, var(--primary) 13%, transparent)",
            color: "var(--primary)",
            "& .MuiListItemIcon-root": { color: "var(--primary)" },
          },
          "&.Mui-selected:hover": {
            backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: "var(--sidebar)", borderColor: "var(--border)" },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          backgroundColor: "var(--foreground)",
          color: "var(--background)",
        },
      },
    },
  },
});
