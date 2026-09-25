import type { ReactNode } from "react";

/**
 * Page transition for the authenticated app.
 *
 * Unlike a layout, a template re-mounts on every navigation, so each page
 * fades up into place while the sidebar and top bar stay still. Disabled by
 * the reduced-motion rule in globals.css.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
