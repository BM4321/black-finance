import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

import { Providers } from "@/components/providers";
import {
  DEFAULT_THEME_MODE,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from "@/theme/theme";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Black Finance",
    template: "%s · Black Finance",
  },
  description: "Personal finance management: accounts, budgets, goals and reports.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The pre-paint script sets data-theme on <html> before hydration, so the
    // attribute legitimately differs from the server markup.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <InitColorSchemeScript
          attribute={THEME_ATTRIBUTE}
          defaultMode={DEFAULT_THEME_MODE}
          modeStorageKey={THEME_STORAGE_KEY}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
