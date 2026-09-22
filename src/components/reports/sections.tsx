"use client";

import {
  AccountBalancesChart,
  IncomeExpenseChart,
  NetWorthChart,
  SavingsRateChart,
  SpendingChart,
} from "@/components/reports/charts";
import { ChartSwitcher, useChartType } from "@/components/ui/chart-switcher";
import {
  DEFAULT_INCOME_CHART,
  DEFAULT_SPENDING_CHART,
  INCOME_CHART_TYPES,
  SPENDING_CHART_TYPES,
  type IncomeChartType,
  type SpendingChartType,
} from "@/lib/ui/chart-preferences";
import type { AccountWithBalance } from "@/lib/data/accounts";
import type { CategorySpending, MonthlySummary } from "@/lib/data/dashboard";
import type { NetWorthPoint } from "@/lib/data/reports";

/**
 * Client wrappers around the report charts.
 *
 * The page is a Server Component; these tiny wrappers own only the interactive
 * chart-type choice (local state + localStorage) and pass the server-fetched
 * data straight through. Keeping the switch here means the data is never
 * re-fetched just to change how it is drawn.
 */

const INCOME_LABELS: Record<IncomeChartType, string> = {
  bar: "Bars",
  line: "Lines",
  area: "Area",
};

const SPENDING_LABELS: Record<SpendingChartType, string> = {
  pie: "Pie",
  bar: "Bars",
  list: "List",
};

const INCOME_OPTIONS = INCOME_CHART_TYPES.map((value) => ({
  value,
  label: INCOME_LABELS[value],
}));

const SPENDING_OPTIONS = SPENDING_CHART_TYPES.map((value) => ({
  value,
  label: SPENDING_LABELS[value],
}));

export function IncomeExpenseSection({
  data,
  title = "Income vs expenses",
}: {
  data: MonthlySummary[];
  title?: string;
}) {
  const [variant, setVariant] = useChartType<IncomeChartType>(
    DEFAULT_INCOME_CHART,
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <ChartSwitcher
          chartId="income"
          options={INCOME_OPTIONS}
          value={variant}
          onChange={setVariant}
          label="Income vs expenses chart type"
        />
      </div>
      <IncomeExpenseChart data={data} variant={variant} />
    </div>
  );
}

export function SpendingSection({
  data,
  title = "Spending by category",
}: {
  data: CategorySpending[];
  title?: string;
}) {
  const [variant, setVariant] = useChartType<SpendingChartType>(
    DEFAULT_SPENDING_CHART,
  );

  if (data.length === 0) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <p className="py-16 text-center text-sm text-muted-foreground">
          No expenses in this period.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <ChartSwitcher
          chartId="spending"
          options={SPENDING_OPTIONS}
          value={variant}
          onChange={setVariant}
          label="Spending chart type"
        />
      </div>
      <SpendingChart data={data} variant={variant} />
    </div>
  );
}

export function SavingsRateSection({ data }: { data: MonthlySummary[] }) {
  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold">Savings rate</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Share of income kept each month. Months with no income are skipped.
      </p>
      <SavingsRateChart data={data} />
    </div>
  );
}

export function NetWorthSection({ data }: { data: NetWorthPoint[] }) {
  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold">Net worth over time</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Accounts only. Investments and debts have no historical value, so they
        are excluded from this trend.
      </p>
      <NetWorthChart data={data} />
    </div>
  );
}

export function AccountBalancesSection({
  data,
}: {
  data: AccountWithBalance[];
}) {
  if (data.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold">Account balances</h2>
        <p className="py-16 text-center text-sm text-muted-foreground">
          No accounts yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Account balances</h2>
      <AccountBalancesChart data={data} />
    </div>
  );
}
