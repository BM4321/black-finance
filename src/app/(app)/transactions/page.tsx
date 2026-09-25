
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
import AddRounded from "@mui/icons-material/AddRounded";
import { LinkButton } from "@/components/ui/link-button";
import { StatCard } from "@/components/dashboard/stat-card";

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
          <LinkButton href="/transactions/new" variant="primary" startIcon={<AddRounded />}>
            Add transaction
          </LinkButton>
        }
      />

      {/* Summary of the filtered set. Totals come from the database. */}
      <div className="stagger mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Income" value={formatMoney(totals.income)} tone="positive" />
        <StatCard label="Expenses" value={formatMoney(totals.expense)} tone="negative" />
        <StatCard label="Transfers" value={formatMoney(totals.transfer)} hint="Not counted as spending" tone="muted" />
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
    <LinkButton href={href} variant="secondary">
      {children}
    </LinkButton>
  );
}
