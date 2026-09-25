import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/ui/brand";
import { LinkButton } from "@/components/ui/link-button";
import { NavIcon } from "@/components/ui/nav-icon";
import type { NavIconName } from "@/lib/ui/nav";

/**
 * Public landing page.
 *
 * Explains what the system holds and how it is used, then hands the visitor a
 * clear choice: register or sign in. Static on purpose: no data is read here,
 * and signed-in visitors are sent on to the dashboard by the auth routes.
 */

type Feature = {
  icon: NavIconName | "assistant";
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    icon: "accounts",
    title: "Accounts",
    body: "Cash, bank, mobile money, savings and investment accounts, each with its own running balance.",
  },
  {
    icon: "transactions",
    title: "Transactions",
    body: "Record income, expenses and transfers. Transfers move money between your accounts and are never counted as spending.",
  },
  {
    icon: "budgets",
    title: "Budgets",
    body: "Set a monthly limit per category and see what is left, what is close, and what has gone over.",
  },
  {
    icon: "goals",
    title: "Savings goals",
    body: "Name a target, log contributions, and watch progress toward it.",
  },
  {
    icon: "investments",
    title: "Investments",
    body: "Keep holdings and their market value alongside everything else, so net worth is complete.",
  },
  {
    icon: "debts",
    title: "Debts",
    body: "Track money you owe and money owed to you, and see the net position at a glance.",
  },
  {
    icon: "reports",
    title: "Dashboard & reports",
    body: "Net worth, cash flow, spending by category and savings rate, month by month.",
  },
  {
    icon: "assistant",
    title: "AI assistant",
    body: "Ask questions in plain language. Answers come only from your own records, never from guesses.",
  },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: "Create your account",
    body: "Register with your email and a password. Your data is private to you from the first minute.",
  },
  {
    title: "Add where your money lives",
    body: "Set up each account with its opening balance: cash, bank, mobile money, savings, investments.",
  },
  {
    title: "Record what happens",
    body: "Log income, expenses and transfers as they occur. Balances update automatically.",
  },
  {
    title: "Plan and review",
    body: "Set budgets and goals, then use the dashboard, reports and assistant to see how you are doing.",
  },
];

const SAFEGUARDS: { title: string; body: string }[] = [
  {
    title: "Your data is yours alone",
    body: "Every record is locked to your account at the database level, so no other user can read it.",
  },
  {
    title: "Automatic sign-out",
    body: "Inactive sessions end on their own, so an unattended screen does not stay open.",
  },
  {
    title: "Exact figures",
    body: "Totals are computed from your records. The assistant is told never to invent a number.",
  },
];

function SparkIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </p>
  );
}

function Brand() {
  return (
    <Link href="/" aria-label="Black Finance home">
      <BrandMark />
    </Link>
  );
}

/** Illustrative preview of the dashboard. Example figures, labelled as such. */
function ProductPreview() {
  const segments = [
    { label: "Spendable", width: "13%", className: "bg-foreground" },
    { label: "Savings", width: "28%", className: "bg-primary" },
    { label: "Investments", width: "59%", className: "bg-primary/45" },
  ];

  return (
    <div
      aria-label="Example dashboard"
      className="rounded-2xl border border-border bg-surface p-6 shadow-2xl shadow-black/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Net worth</p>
          <p className="tabular-nums mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            TSh 48,250,000
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Example
        </span>
      </div>

      <div className="mt-6 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={segment.className}
            style={{ width: segment.width }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${segment.className}`} />
            {segment.label}
          </li>
        ))}
      </ul>

      <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5">
        <div>
          <dt className="text-xs text-muted-foreground">Income</dt>
          <dd className="tabular-nums mt-1 text-sm font-semibold text-positive">
            7.2M
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Spent</dt>
          <dd className="tabular-nums mt-1 text-sm font-semibold">4.7M</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Savings rate</dt>
          <dd className="tabular-nums mt-1 text-sm font-semibold text-primary">
            34.7%
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-4 sm:px-6">
          <Brand />
          <nav
            aria-label="Sections"
            className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
          >
            <a href="#features" className="hover:text-foreground">
              What’s inside
            </a>
            <a href="#how-it-works" className="hover:text-foreground">
              How it works
            </a>
            <a href="#privacy" className="hover:text-foreground">
              Privacy
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LinkButton href="/login" variant="ghost">
              Sign in
            </LinkButton>
            <LinkButton href="/signup" variant="primary">
              Register
            </LinkButton>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero ------------------------------------------------------------ */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div className="animate-fade-up">
            <Eyebrow>Personal finance · built for TZS & mobile money</Eyebrow>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Know exactly where your money stands.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Black Finance brings your accounts, spending, budgets, goals,
              investments and debts into one private ledger, with an assistant
              that answers questions from your own records.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/signup" variant="primary" size="large">
                Create an account
              </LinkButton>
              <LinkButton href="/login" variant="secondary" size="large">
                Sign in
              </LinkButton>
            </div>
          </div>
          <div className="animate-fade-up [animation-delay:120ms]">
            <ProductPreview />
          </div>
        </section>

        {/* Features -------------------------------------------------------- */}
        <section
          id="features"
          className="scroll-mt-20 border-t border-border bg-surface/40"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <Eyebrow>What’s inside</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
              Everything you need to run your money, in one place.
            </h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <li
                  key={feature.title}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    {feature.icon === "assistant" ? (
                      <SparkIcon />
                    ) : (
                      <NavIcon name={feature.icon} fontSize="medium" />
                    )}
                  </span>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works ---------------------------------------------------- */}
        <section id="how-it-works" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
              Four steps from sign-up to a clear picture.
            </h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="border-t border-border pt-5">
                  <span className="tabular-nums font-mono text-sm text-primary">
                    0{index + 1}
                  </span>
                  <h3 className="mt-2 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Privacy --------------------------------------------------------- */}
        <section
          id="privacy"
          className="scroll-mt-20 border-t border-border bg-surface/40"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_2fr]">
            <div>
              <Eyebrow>Privacy</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Built to keep your finances private.
              </h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-3">
              {SAFEGUARDS.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Choose: register or sign in ------------------------------------ */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">
              Ready to begin?
            </h2>
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
              <div className="flex flex-col rounded-2xl border border-primary/40 bg-surface p-6">
                <h3 className="text-lg font-semibold">New to Black Finance</h3>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">
                  Create an account with your email and start adding your
                  accounts.
                </p>
                <LinkButton href="/signup" variant="primary" size="large" fullWidth className="mt-6">
                  Register
                </LinkButton>
              </div>
              <div className="flex flex-col rounded-2xl border border-border bg-surface p-6">
                <h3 className="text-lg font-semibold">Already have an account</h3>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">
                  Sign in to pick up where you left off.
                </p>
                <LinkButton href="/login" variant="secondary" size="large" fullWidth className="mt-6">
                  Sign in
                </LinkButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <Brand />
          <p>Personal finance, kept private.</p>
        </div>
      </footer>
    </div>
  );
}
