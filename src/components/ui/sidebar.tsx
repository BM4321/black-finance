import { cookies } from "next/headers";

import { SidebarNav } from "@/components/ui/sidebar-nav";
import {
  parseSidebarCollapsed,
  SIDEBAR_COOKIE,
} from "@/lib/ui/sidebar";
import type { NavItem } from "@/lib/ui/nav";

/**
 * Server wrapper for the sidebar.
 *
 * Reads the collapse preference from a cookie so the correct initial width is
 * rendered on the server, avoiding a hydration mismatch and a width flicker.
 * The interactive rail lives in the client `SidebarNav`.
 */
export async function Sidebar({
  items,
  email,
}: {
  items: NavItem[];
  email?: string;
}) {
  const cookieStore = await cookies();
  const collapsed = parseSidebarCollapsed(
    cookieStore.get(SIDEBAR_COOKIE)?.value,
  );

  return <SidebarNav items={items} email={email} collapsed={collapsed} />;
}
