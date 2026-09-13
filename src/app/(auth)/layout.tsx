import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Shared shell for auth screens. Centered, narrow, and calm — the only thing
 * on the page is the task at hand.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-md px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Finance
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        {children}
      </main>
    </div>
  );
}
