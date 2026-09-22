"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/ui/nav-icon";
import {
  SIDEBAR_COOKIE,
  SIDEBAR_COOKIE_OPTIONS,
} from "@/lib/ui/sidebar";
import { isActiveRoute, type NavItem } from "@/lib/ui/nav";

/**
 * Collapsible desktop sidebar.
 *
 * Expanded it shows icon + label; collapsed it is an icon rail. The collapse
 * state is initialised from a cookie by the server (see `Sidebar` server
 * wrapper), so the first paint is already correct. Toggling writes the cookie
 * and updates a CSS class on the root, with no React state and therefore no
 * hydration mismatch or layout flicker.
 *
 * Hidden below `md`, where the mobile drawer takes over. Collapsed items keep
 * an accessible name via `aria-label` so an icon-only rail stays usable.
 */
export function SidebarNav({
  items,
  email,
  collapsed,
}: {
  items: NavItem[];
  email?: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();

  function toggle() {
    const next = !collapsed;
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=${SIDEBAR_COOKIE_OPTIONS.path}; max-age=${SIDEBAR_COOKIE_OPTIONS.maxAge}; samesite=lax`;
    // Toggle the rail on the DOM directly rather than in React state: the
    // preference is owned by the cookie, and a re-render is unnecessary. A
    // full reload would lose scroll position and any open panels.
    const root = document.querySelector<HTMLElement>("[data-sidebar-root]");
    if (root) root.dataset.collapsed = next ? "true" : "false";
  }

  return (
    <aside
      data-sidebar-root
      data-collapsed={collapsed ? "true" : "false"}
      className="sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface md:flex"
    >
      {/* Brand ---------------------------------------------------------- */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 overflow-hidden font-semibold tracking-tight"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            B
          </span>
          <span className="sidebar-label truncate">Finance</span>
        </Link>
      </div>

      {/* Destinations --------------------------------------------------- */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <NavIcon name={item.icon} />
                  <span className="sidebar-label truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer: user, collapse ---------------------------------------- */}
      <div className="border-t border-border p-2">
        {email && (
          <p className="sidebar-label truncate px-2 pb-2 text-xs text-muted-foreground">
            {email}
          </p>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="sidebar-chevron shrink-0 transition-transform duration-200"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
          <span className="sidebar-label">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
