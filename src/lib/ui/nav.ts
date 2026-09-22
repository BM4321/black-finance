export type NavIconName =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "budgets"
  | "goals"
  | "investments"
  | "debts"
  | "reports";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
};

/**
 * Primary navigation, defined once and shared by the sidebar and the mobile
 * drawer. Icons are referenced by name so this module stays free of JSX and
 * can be imported from both server and client components.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/transactions", label: "Transactions", icon: "transactions" },
  { href: "/accounts", label: "Accounts", icon: "accounts" },
  { href: "/budgets", label: "Budgets", icon: "budgets" },
  { href: "/goals", label: "Goals", icon: "goals" },
  { href: "/investments", label: "Investments", icon: "investments" },
  { href: "/debts", label: "Debts", icon: "debts" },
  { href: "/reports", label: "Reports", icon: "reports" },
];

/** True when `href` is the current route or an ancestor of it. */
export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
