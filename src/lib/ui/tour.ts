/**
 * Guided tour for new users.
 *
 * Plain data, so the steps can be tested and edited without touching the
 * component. Each step names the page it belongs to and the element to
 * highlight by its `data-tour` marker. `targets` is a list: the first one
 * that is visible wins, so a step can point at the sidebar on desktop and at
 * the menu button on a phone. A step whose target is missing (for example a
 * form that is collapsed) is shown centred instead of failing.
 */

export type TourStep = {
  id: string;
  /** Page the step belongs to; the tour navigates there on Next/Back. */
  path: string;
  /** `data-tour` markers, in order of preference. Empty = a centred card. */
  targets: readonly string[];
  title: string;
  body: string;
};

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "welcome",
    path: "/dashboard",
    targets: [],
    title: "Welcome to Black Finance",
    body: "A two-minute walkthrough: we’ll add your first account, record a transaction and plan a budget. You can skip any time and replay it from the sidebar.",
  },
  {
    id: "navigation",
    path: "/dashboard",
    targets: ["nav", "menu-button"],
    title: "Everything lives here",
    body: "Money covers day-to-day: your dashboard, transactions and accounts. Plan holds budgets, goals and reports. Wealth tracks investments and debts.",
  },
  {
    id: "net-worth",
    path: "/dashboard",
    targets: ["net-worth"],
    title: "Your headline number",
    body: "Net worth adds up everything you own and are owed, minus what you owe. It fills in as you add accounts and transactions.",
  },
  {
    id: "add-account",
    path: "/accounts",
    targets: ["add-account"],
    title: "Start with an account",
    body: "An account is anywhere money lives: cash, a bank, M-Pesa or a savings account. Click “Add account”, or press Next and we’ll open the form for you.",
  },
  {
    id: "account-name",
    path: "/accounts/new",
    targets: ["account-name"],
    title: "Name it",
    body: "Use the name you’d recognise, such as “NMB Bank” or “M-Pesa”.",
  },
  {
    id: "account-type",
    path: "/accounts/new",
    targets: ["account-type"],
    title: "Pick its type",
    body: "Savings accounts are kept apart from spendable money, so money set aside never looks like cash to spend. Currency defaults to TZS.",
  },
  {
    id: "account-balance",
    path: "/accounts/new",
    targets: ["account-balance"],
    title: "What’s in it today",
    body: "Enter today’s balance. From here on, the balance updates itself from the transactions you record.",
  },
  {
    id: "account-save",
    path: "/accounts/new",
    targets: ["account-save"],
    title: "Save it",
    body: "Click Create account when you’re ready. Add one for each place you keep money; you can edit them later.",
  },
  {
    id: "transaction-type",
    path: "/transactions/new",
    targets: ["tx-type"],
    title: "Record what happens",
    body: "Choose Expense for spending, Income for money in, or Transfer to move money between your own accounts. Transfers never count as spending.",
  },
  {
    id: "transaction-amount",
    path: "/transactions/new",
    targets: ["tx-amount"],
    title: "Amount and date",
    body: "Enter the amount without a minus sign; the type decides the direction. The date defaults to today.",
  },
  {
    id: "transaction-account",
    path: "/transactions/new",
    targets: ["tx-account"],
    title: "Which account",
    body: "Pick the account the money left or arrived in. Its balance updates as soon as you save.",
  },
  {
    id: "transaction-category",
    path: "/transactions/new",
    targets: ["tx-category"],
    title: "Categorise it",
    body: "Categories like Food or Transport power your budgets and the spending charts.",
  },
  {
    id: "transaction-save",
    path: "/transactions/new",
    targets: ["tx-save"],
    title: "Save the transaction",
    body: "Description, payee and notes are optional. Save, and it appears in your transactions and on the dashboard.",
  },
  {
    id: "budget-period",
    path: "/budgets",
    targets: ["budget-period", "budget-edit"],
    title: "Plan a budget",
    body: "Budget by calendar month, or pick Custom dates to run payday to payday, for example 24 September to 25 October.",
  },
  {
    id: "budget-items",
    path: "/budgets",
    targets: ["budget-items", "budget-edit"],
    title: "Set allowances",
    body: "Choose a category and how much you plan to spend on it. Add as many as you like, then save. Bars turn amber near the limit and red when over.",
  },
  {
    id: "goals",
    path: "/goals",
    targets: ["add-goal"],
    title: "Save towards something",
    body: "Goals track money you put aside for a target, such as an emergency fund or school fees.",
  },
  {
    id: "assistant",
    path: "/goals",
    targets: ["assistant"],
    title: "Ask about your money",
    body: "The assistant answers questions like “How much did I spend on food this month?” using only your own records.",
  },
  {
    id: "done",
    path: "/dashboard",
    targets: ["tour-restart"],
    title: "You’re all set",
    body: "Replay this tour any time from “Take the tour”. Next up: add your accounts and your first few transactions.",
  },
];

/** Where the tour is, saved per user so it survives page loads. */
export type TourProgress = { status: "active" | "done"; index: number };

export function tourStorageKey(userId: string): string {
  return `bf-tour:${userId}`;
}

/** Read saved progress, tolerating anything malformed (it is user-editable). */
export function parseTourProgress(raw: string | null): TourProgress | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TourProgress>;
    if (value.status !== "active" && value.status !== "done") return null;
    const index = Number(value.index);
    if (!Number.isInteger(index) || index < 0 || index >= TOUR_STEPS.length) {
      return { status: value.status, index: 0 };
    }
    return { status: value.status, index };
  } catch {
    return null;
  }
}

/** New users see the tour automatically for this long after signing up. */
export const TOUR_AUTO_START_DAYS = 14;

export function isNewUser(createdAt: string | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  return now - created <= TOUR_AUTO_START_DAYS * 86_400_000;
}
