export type NavIconName =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "budgets"
  | "goals"
  | "investments"
  | "debts"
  | "reports";

export type NavGroup = "Money" | "Plan" | "Wealth";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  group: NavGroup;
};

/** Section order in the sidebar and drawer. */
export const NAV_GROUPS: readonly NavGroup[] = ["Money", "Plan", "Wealth"];

/**
 * Primary navigation, defined once and shared by the sidebar and the mobile
 * drawer. Icons are referenced by name so this module stays free of JSX and
 * can be imported from both server and client components.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", group: "Money" },
  { href: "/transactions", label: "Transactions", icon: "transactions", group: "Money" },
  { href: "/accounts", label: "Accounts", icon: "accounts", group: "Money" },
  { href: "/budgets", label: "Budgets", icon: "budgets", group: "Plan" },
  { href: "/goals", label: "Goals", icon: "goals", group: "Plan" },
  { href: "/investments", label: "Investments", icon: "investments", group: "Wealth" },
  { href: "/debts", label: "Debts", icon: "debts", group: "Wealth" },
  { href: "/reports", label: "Reports", icon: "reports", group: "Plan" },
];

/** True when `href` is the current route or an ancestor of it. */
export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
