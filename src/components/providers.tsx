"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import type { ReactNode } from "react";

import { theme } from "@/theme/theme";

/**
 * App-wide Material UI providers.
 *
 * `AppRouterCacheProvider` collects Emotion styles during server rendering so
 * the first paint is styled. `enableCssLayer` puts MUI's styles in the `mui`
 * cascade layer declared in globals.css, below Tailwind utilities, so a
 * utility class on an MUI component (spacing, layout) always wins.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
