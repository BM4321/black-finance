"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NavIcon } from "@/components/ui/nav-icon";
import { isActiveRoute, type NavItem } from "@/lib/ui/nav";

/**
 * Mobile navigation drawer.
 *
 * Below `md` the sidebar is hidden, so navigation collapses into a hamburger
 * that opens a slide-over panel. It closes on navigation (each link closes it),
 * on Escape, and on backdrop click, and locks body scroll while open. The panel
 * is only rendered in the DOM when open, so it is never reachable by keyboard
 * or screen readers when closed.
 */
export function MobileNav({ items, email }: { items: NavItem[]; email?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on Escape and lock scroll while open. This effect only touches
  // external systems (the DOM and the document), never React state, so it does
  // not cause cascading renders.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground md:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6h16M4 12h16M4 18h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="animate-overlay-in absolute inset-0 bg-black/40"
          />

          {/* Panel */}
          <nav className="animate-slide-in-right absolute inset-y-0 right-0 flex w-72 max-w-[85%] flex-col border-l border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  B
                </span>
                Finance
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <ul className="stagger flex-1 overflow-y-auto p-2">
              {items.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-surface-muted"
                      }`}
                    >
                      <NavIcon name={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {email && (
              <div className="border-t border-border px-4 py-3">
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
