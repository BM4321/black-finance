import type { NavIconName } from "@/lib/ui/nav";

/**
 * Inline SVG icons for the navigation.
 *
 * Hand-rolled rather than pulling in an icon package: eight icons is below the
 * threshold where a dependency pays for itself, and these inherit
 * `currentColor` so they theme automatically. `aria-hidden` because every icon
 * is paired with a visible or labelled text node.
 */
export function NavIcon({ name }: { name: NavIconName }) {
  const paths: Record<NavIconName, string> = {
    dashboard:
      "M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-12h8V3h-8v6z",
    transactions:
      "M7 7h11l-3-3m0 0l-3 3m3-3v10M17 17H6l3 3m0 0l3-3m-3 3V10",
    accounts:
      "M3 10h18M3 10l9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18",
    budgets:
      "M12 3v18M7 8h7a3 3 0 010 6H7m0 0h8",
    goals:
      "M12 21a9 9 0 100-18 9 9 0 000 18zm0-4.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0-3a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
    investments:
      "M3 17l6-6 4 4 8-8m0 0h-5m5 0v5",
    debts:
      "M12 3v18M8 7h6a3 3 0 010 6H9a3 3 0 000 6h7",
    reports:
      "M9 17V9m4 8v-3m4 3V5M4 20h16",
  };

  return (
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
      className="shrink-0"
    >
      <path d={paths[name]} />
    </svg>
  );
}
