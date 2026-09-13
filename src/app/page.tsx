import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">Finance</span>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Your money, finally out of the spreadsheet.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Track income, expenses and transfers across every account. Budget
          deliberately, watch your goals grow, and see where your money actually
          goes.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border bg-surface px-5 py-3 text-center text-sm font-medium transition-colors hover:bg-surface-muted"
          >
            I already have one
          </Link>
        </div>
      </section>
    </main>
  );
}
