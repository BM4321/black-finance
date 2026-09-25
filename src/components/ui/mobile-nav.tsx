"use client";

import CloseRounded from "@mui/icons-material/CloseRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/ui/brand";
import { NavIcon } from "@/components/ui/nav-icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { isActiveRoute, NAV_GROUPS, type NavItem } from "@/lib/ui/nav";

/**
 * Mobile navigation: a Material UI Drawer opened from a menu button.
 *
 * Below `md` the sidebar is hidden, so navigation lives here. The Drawer
 * handles focus trapping, Escape, backdrop clicks and scroll locking; each
 * link closes it so the new page is visible straight away.
 */
export function MobileNav({ items, email }: { items: NavItem[]; email?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <IconButton
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="md:hidden"
      >
        <MenuRounded />
      </IconButton>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: 300, maxWidth: "85%" } } }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <BrandMark />
          <IconButton onClick={() => setOpen(false)} aria-label="Close navigation menu">
            <CloseRounded />
          </IconButton>
        </div>

        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3">
          {NAV_GROUPS.map((group) => (
            <List
              key={group}
              disablePadding
              sx={{ mb: 1.5 }}
              subheader={
                <ListSubheader
                  disableSticky
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
                      onClick={() => setOpen(false)}
                      selected={active}
                      aria-current={active ? "page" : undefined}
                      sx={{ minHeight: 48, gap: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 0 }}>
                        <NavIcon name={item.icon} />
                      </ListItemIcon>
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  );
                })}
            </List>
          ))}
        </nav>

        <div className="border-t border-border p-2">
          {email && (
            <p className="truncate px-3 pb-2 pt-1 text-xs text-muted-foreground">{email}</p>
          )}
          <ThemeToggle variant="row" />
          <form action={signOut}>
            <ListItemButton
              component="button"
              type="submit"
              sx={{ minHeight: 48, gap: 1.5, width: "100%" }}
            >
              <ListItemIcon sx={{ minWidth: 0 }}>
                <LogoutRounded fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Sign out" />
            </ListItemButton>
          </form>
        </div>
      </Drawer>
    </>
  );
}
