import Link from "next/link";

import { AssistantLauncher } from "@/components/assistant/assistant-launcher";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { MobileNav } from "@/components/ui/mobile-nav";
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
        {/* Top bar: mobile menu and actions. On desktop the sidebar owns the
            destinations, so this bar is slim. */}
        <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
            <Link
              href="/dashboard"
              className="font-semibold tracking-tight md:hidden"
            >
              Finance
            </Link>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <SignOutButton />
              <MobileNav items={NAV_ITEMS} email={user.email ?? undefined} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>

      {/* Floating assistant is available on every authenticated page. */}
      <AssistantLauncher configured={isAssistantConfigured()} />
    </div>
  );
}
