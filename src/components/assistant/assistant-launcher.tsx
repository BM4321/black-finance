"use client";

import { useEffect, useRef, useState } from "react";

import { AssistantChat } from "@/components/assistant/assistant-chat";

/**
 * Floating assistant launcher.
 *
 * A single button pinned to the bottom-right of every authenticated page. It
 * opens a chat panel above itself. Kept as a client component because the open
 * state and conversation are per-session UI state.
 *
 * The conversation lives inside the panel, so it persists while the page
 * underneath changes (the panel is mounted in the app layout, not per page),
 * and survives closing/reopening during the session.
 */
export function AssistantLauncher({ configured }: { configured: boolean }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape, matching standard dialog behaviour.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Panel ---------------------------------------------------------- */}
      {open && (
        <div
          role="dialog"
          aria-label="Financial assistant"
          className="fixed inset-x-3 bottom-20 z-50 flex h-[min(70vh,560px)] flex-col rounded-2xl border border-border bg-background p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[26rem]"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Financial assistant</h2>
              <p className="text-xs text-muted-foreground">
                Grounded in your own data
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-lg px-2 py-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <AssistantChat configured={configured} />
          </div>
        </div>
      )}

      {/* Launcher ------------------------------------------------------- */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close financial assistant" : "Open financial assistant"}
        className="fixed bottom-6 right-6 z-50 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span aria-hidden className="text-lg leading-none">
          {open ? "✕" : "✦"}
        </span>
        <span className="hidden sm:inline">
          {open ? "Close" : "Ask AI"}
        </span>
      </button>
    </>
  );
}
