import Card from "@mui/material/Card";
import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Shared shell for auth screens: the brand, then a single rounded card holding
 * the task at hand. Calm and narrow, with nothing else competing for attention.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/" aria-label="Black Finance home">
          <BrandMark />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16 sm:px-6">
        <Card className="animate-scale-in" sx={{ p: { xs: 3, sm: 4 }, borderRadius: "24px" }}>{children}</Card>
      </main>
    </div>
  );
}
