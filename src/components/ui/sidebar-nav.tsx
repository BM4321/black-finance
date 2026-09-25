"use client";

import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/ui/brand";
import { NavIcon } from "@/components/ui/nav-icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  SIDEBAR_COOKIE,
  SIDEBAR_COOKIE_OPTIONS,
} from "@/lib/ui/sidebar";
import { isActiveRoute, NAV_GROUPS, type NavItem } from "@/lib/ui/nav";

const ITEM_SX = { minHeight: 40, px: 1.5, gap: 1.5 } as const;
const ICON_SX = { minWidth: 0, color: "text.secondary" } as const;

/**
 * Collapsible desktop sidebar, built from Material UI list components.
 *
 * Expanded it shows grouped icon + label rows; collapsed it is an icon rail.
 * The collapse state is initialised from a cookie by the server (see the
 * `Sidebar` server wrapper), so the first paint is already correct. Toggling
 * writes the cookie and flips a data attribute that CSS reads, with no React
 * state and therefore no hydration mismatch or layout flicker.
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
    const root = document.querySelector<HTMLElement>("[data-sidebar-root]");
    const next = root?.dataset.collapsed !== "true";
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=${SIDEBAR_COOKIE_OPTIONS.path}; max-age=${SIDEBAR_COOKIE_OPTIONS.maxAge}; samesite=lax`;
    // Toggle the rail on the DOM directly rather than in React state: the
    // preference is owned by the cookie, and a re-render is unnecessary.
    if (root) root.dataset.collapsed = next ? "true" : "false";
  }

  return (
    <aside
      data-sidebar-root
      data-collapsed={collapsed ? "true" : "false"}
      className="sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar md:flex"
    >
      {/* Brand ---------------------------------------------------------- */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <Link href="/dashboard" className="overflow-hidden">
          <BrandMark labelClassName="sidebar-label" />
        </Link>
      </div>

      {/* Destinations, grouped ----------------------------------------- */}
      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <List
            key={group}
            dense
            disablePadding
            sx={{ mb: 1.5 }}
            subheader={
              <ListSubheader
                disableSticky
                className="sidebar-label"
                sx={{
                  bgcolor: "transparent",
                  lineHeight: "28px",
                  px: 1.5,
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "text.disabled",
                }}
              >
                {group}
              </ListSubheader>
            }
          >
            {items
              .filter((item) => item.group === group)
              .map((item) => {
                const active = isActiveRoute(pathname, item.href);
                return (
                  <ListItemButton
                    key={item.href}
                    component={Link}
                    href={item.href}
                    selected={active}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                    title={item.label}
                    sx={{ ...ITEM_SX, mb: 0.25 }}
                  >
                    <ListItemIcon sx={ICON_SX}>
                      <NavIcon name={item.icon} />
                    </ListItemIcon>
                    <ListItemText
                      className="sidebar-label"
                      primary={item.label}
                      slotProps={{ primary: { noWrap: true, sx: { fontSize: 14, fontWeight: 500 } } }}
                    />
                  </ListItemButton>
                );
              })}
          </List>
        ))}
      </nav>

      {/* Footer: user, theme, sign out, collapse ------------------------------ */}
      <div className="border-t border-border p-2">
        {email && (
          <p className="sidebar-label truncate px-3 pb-2 pt-1 text-xs text-muted-foreground">
            {email}
          </p>
        )}
        <ThemeToggle variant="row" labelClassName="sidebar-label" />
        <form action={signOut}>
          <ListItemButton
            component="button"
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            sx={{ ...ITEM_SX, width: "100%" }}
          >
            <ListItemIcon sx={ICON_SX}>
              <LogoutRounded fontSize="small" />
            </ListItemIcon>
            <ListItemText
              className="sidebar-label"
              primary="Sign out"
              slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }}
            />
          </ListItemButton>
        </form>
        <ListItemButton
          component="button"
          type="button"
          onClick={toggle}
          aria-label="Collapse or expand sidebar"
          title="Collapse or expand sidebar"
          sx={{ ...ITEM_SX, width: "100%" }}
        >
          <ListItemIcon sx={ICON_SX}>
            <ChevronLeftRounded
              fontSize="small"
              className="sidebar-chevron transition-transform duration-200"
            />
          </ListItemIcon>
          <ListItemText
            className="sidebar-label"
            primary="Collapse"
            slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 500 } } }}
          />
        </ListItemButton>
      </div>
    </aside>
  );
}
