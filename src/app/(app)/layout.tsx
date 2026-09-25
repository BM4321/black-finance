import Link from "next/link";

import { AssistantLauncher } from "@/components/assistant/assistant-launcher";
import { BrandMark } from "@/components/ui/brand";
import { MobileNav } from "@/components/ui/mobile-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar } from "@/components/ui/sidebar";
import { isAssistantConfigured } from "@/lib/ai/config";
import { requireUser } from "@/lib/auth";
import { NAV_ITEMS } from "@/lib/ui/nav";

/**
 * Layout for all authenticated app routes.
 *
 * Desktop uses a persistent, collapsible sidebar (see `Sidebar`); mobile uses a
 * hamburger drawer. requireUser() is a server-side guard in addition to the
 * proxy redirect, so a missed proxy matcher can never expose an authenticated
 * page.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar items={NAV_ITEMS} email={user.email ?? undefined} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: brand and menu. On desktop the sidebar owns
            navigation, account and sign-out, so no top bar is needed. */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-2">
            <Link href="/dashboard">
              <BrandMark />
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <MobileNav items={NAV_ITEMS} email={user.email ?? undefined} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-6 md:py-8 lg:px-10">
          {children}
        </main>
      </div>

      {/* Floating assistant is available on every authenticated page. */}
      <AssistantLauncher configured={isAssistantConfigured()} />
    </div>
  );
}
