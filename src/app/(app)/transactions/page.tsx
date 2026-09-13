import Link from "next/link";

import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionList } from "@/components/transactions/transaction-list";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { listAccounts } from "@/lib/data/accounts";
import { listCategories } from "@/lib/data/categories";
import {
  getTransactions,
  type TransactionFilters as Filters,
} from "@/lib/data/transactions";
import { formatMoney } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType } from "@/types/domain";

export const metadata = { title: "Transactions" };

const VALID_TYPES: TransactionType[] = ["income", "expense", "transfer"];

/**
 * Parse URL search params into filters.
 *
 * Only recognised values are passed through, so a malformed query string can
 * never reach the database layer as a surprise filter.
 */
function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const single = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  };

  const type = single("type");
  const page = Number(single("page") ?? "1");

  return {
    search: single("search"),
    type: type && VALID_TYPES.includes(type as TransactionType)
      ? (type as TransactionType)
      : undefined,
    accountId: single("account"),
    categoryId: single("category"),
    dateFrom: single("from"),
    dateTo: single("to"),
    amountMin: single("min"),
    amountMax: single("max"),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function buildPageHref(
  params: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    if (typeof value === "string" && value.length > 0) next.set(key, value);
  }
  next.set("page", String(page));
  return `/transactions?${next.toString()}`;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const filters = parseFilters(params);

  const supabase = await createClient();
  const [page, accounts, categories] = await Promise.all([
    getTransactions(supabase, filters),
    listAccounts(supabase),
    listCategories(supabase),
  ]);

  const { transactions, total, pageCount, totals } = page;
  const currentPage = page.page;

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={`${total} transaction${total === 1 ? "" : "s"}`}
        action={
          <Link
            href="/transactions/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Add transaction
          </Link>
        }
      />

      {/* Summary of the filtered set. Totals come from the database. */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Income
          </span>
          <p className="tabular-nums text-lg font-semibold text-positive">
            {formatMoney(totals.income)}
          </p>
        </Card>
        <Card className="px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Expenses
          </span>
          <p className="tabular-nums text-lg font-semibold text-negative">
            {formatMoney(totals.expense)}
          </p>
        </Card>
        <Card className="px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Transfers
          </span>
          <p className="tabular-nums text-lg font-semibold text-muted-foreground">
            {formatMoney(totals.transfer)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Not counted as spending
          </span>
        </Card>
      </div>

      <div className="mb-4">
        <TransactionFilters accounts={accounts} categories={categories} />
      </div>

      <Card className="overflow-hidden">
        <TransactionList transactions={transactions} />
      </Card>

      {pageCount > 1 && (
        <nav
          className="mt-4 flex items-center justify-between"
          aria-label="Pagination"
        >
          <PageLink
            href={buildPageHref(params, currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </PageLink>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {pageCount}
          </span>
          <PageLink
            href={buildPageHref(params, currentPage + 1)}
            disabled={currentPage >= pageCount}
          >
            Next
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-muted"
    >
      {children}
    </Link>
  );
}
