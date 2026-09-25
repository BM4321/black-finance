"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart, lineClasses } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";

import { ProgressBar } from "@/components/ui/progress-bar";
import { savingsRateSeries } from "@/lib/finance/reports";
import { formatMoney } from "@/lib/finance/money";
import type { CategorySpending, MonthlySummary } from "@/lib/data/dashboard";
import type { NetWorthPoint } from "@/lib/data/reports";
import type { AccountWithBalance } from "@/lib/data/accounts";
import type {
  IncomeChartType,
  SpendingChartType,
} from "@/lib/ui/chart-preferences";
import { CHART_COLORS, tokens } from "@/theme/theme";

/**
 * Report charts, built on MUI X Charts.
 *
 * Every mark is rounded: bars carry a corner radius, donut slices have rounded
 * ends and gaps, and lines use a smooth curve with round joins. Colours come
 * from the theme's chart palette, so charts follow the rest of the UI.
 */

/** "2026-01" -> "Jan 2026" without a date library. */
export function monthLabel(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, 1));
  return date.toLocaleDateString("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function compact(value: number | null): string {
  if (value === null) return "";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

function money(value: number | null): string {
  return value === null ? "—" : formatMoney(value);
}

/** Kept for callers that colour legends to match the charts. */
export const PALETTE = CHART_COLORS;

const INCOME_COLOR = tokens.foreground;
const EXPENSE_COLOR = tokens.primary;
const BAR_RADIUS = 8;
const HEIGHT = 300;

/** Soft area fill and round line joins for every line/area chart. */
const LINE_SX = {
  [`& .${lineClasses.area}`]: { fillOpacity: 0.16 },
  [`& .${lineClasses.line}`]: {
    strokeWidth: 2.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
} as const;

const GRID = { horizontal: true } as const;

/**
 * Income vs expenses, in the chosen style.
 *
 * Three renderings of the same data so the user can pick what reads best for
 * them: rounded grouped bars (compare), smooth lines (trend), or smooth
 * overlapping areas (volume). Income is light and expenses gold, so the two
 * differ in lightness, not only hue.
 */
export function IncomeExpenseChart({
  data,
  variant = "bar",
}: {
  data: MonthlySummary[];
  variant?: IncomeChartType;
}) {
  const months = data.map((row) => monthLabel(row.monthStart));
  const income = data.map((row) => Number(row.income));
  const expenses = data.map((row) => Number(row.expense));

  if (variant === "bar") {
    return (
      <BarChart
        height={HEIGHT}
        borderRadius={BAR_RADIUS}
        grid={GRID}
        xAxis={[
          {
            scaleType: "band",
            data: months,
            categoryGapRatio: 0.35,
            barGapRatio: 0.15,
          },
        ]}
        yAxis={[{ valueFormatter: compact, width: 56 }]}
        series={[
          { data: income, label: "Income", color: INCOME_COLOR, valueFormatter: money },
          { data: expenses, label: "Expenses", color: EXPENSE_COLOR, valueFormatter: money },
        ]}
      />
    );
  }

  return (
    <LineChart
      height={HEIGHT}
      grid={GRID}
      sx={LINE_SX}
      xAxis={[{ scaleType: "point", data: months }]}
      yAxis={[{ valueFormatter: compact, width: 56 }]}
      series={[
        {
          data: income,
          label: "Income",
          color: INCOME_COLOR,
          curve: "natural",
          area: variant === "area",
          showMark: variant === "line",
          valueFormatter: money,
        },
        {
          data: expenses,
          label: "Expenses",
          color: EXPENSE_COLOR,
          curve: "natural",
          area: variant === "area",
          showMark: variant === "line",
          valueFormatter: money,
        },
      ]}
    />
  );
}

/**
 * Spending by category, in the chosen style.
 *
 * `pie` is a donut with rounded slice ends and gaps between slices; `bar` is
 * rounded horizontal bars; `list` renders plain rows with progress bars (no
 * chart library), which is also the most screen-reader- and
 * small-screen-friendly option.
 */
export function SpendingChart({
  data,
  variant = "pie",
}: {
  data: CategorySpending[];
  variant?: SpendingChartType;
}) {
  const rows = data.map((row, index) => ({
    name: row.categoryName,
    value: Number(row.total),
    total: row.total,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  if (variant === "list") {
    const max = rows.reduce((acc, row) => Math.max(acc, row.value), 0);
    return (
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.name}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="truncate">{row.name}</span>
              </span>
              <span className="tabular-nums font-medium">
                {formatMoney(row.total)}
              </span>
            </div>
            <ProgressBar
              value={max === 0 ? 0 : (row.value / max) * 100}
              label={`${row.name} share of top category`}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (variant === "bar") {
    return (
      <BarChart
        layout="horizontal"
        height={Math.max(220, rows.length * 44)}
        borderRadius={BAR_RADIUS}
        grid={{ vertical: true }}
        hideLegend
        yAxis={[
          {
            scaleType: "band",
            data: rows.map((row) => row.name),
            width: 110,
            categoryGapRatio: 0.35,
            colorMap: { type: "ordinal", colors: rows.map((row) => row.color) },
          },
        ]}
        xAxis={[{ valueFormatter: compact }]}
        series={[{ data: rows.map((row) => row.value), label: "Spent", valueFormatter: money }]}
      />
    );
  }

  return (
    <PieChart
      height={HEIGHT}
      series={[
        {
          data: rows.map((row, index) => ({
            id: index,
            value: row.value,
            label: row.name,
            color: row.color,
          })),
          innerRadius: "58%",
          outerRadius: "92%",
          paddingAngle: 2.5,
          cornerRadius: 8,
          highlightScope: { fade: "global", highlight: "item" },
          faded: { additionalRadius: -4, color: tokens.border },
          valueFormatter: (item) => formatMoney(item.value),
        },
      ]}
    />
  );
}

/**
 * Savings rate per month as rounded bars: gold when positive, coral when
 * spending exceeded income.
 *
 * Months with no income have a null rate and are left empty, so a zero-income
 * month does not draw a misleading 0%.
 */
export function SavingsRateChart({ data }: { data: MonthlySummary[] }) {
  const series = savingsRateSeries(data);
  const months = series.map((point) => monthLabel(point.monthStart));
  const rates = series.map((point) =>
    point.rate === null ? null : Number((point.rate * 100).toFixed(1)),
  );

  return (
    <BarChart
      height={HEIGHT}
      borderRadius={BAR_RADIUS}
      grid={GRID}
      hideLegend
      xAxis={[{ scaleType: "band", data: months, categoryGapRatio: 0.45 }]}
      yAxis={[
        {
          width: 48,
          valueFormatter: (value: number | null) => (value === null ? "" : `${value}%`),
          colorMap: {
            type: "piecewise",
            thresholds: [0],
            colors: [tokens.negative, tokens.primary],
          },
        },
      ]}
      series={[
        {
          data: rates,
          label: "Savings rate",
          valueFormatter: (value: number | null) => (value === null ? "No income" : `${value}%`),
        },
      ]}
    />
  );
}

/**
 * Account-only net worth over time, as a smooth area.
 *
 * Labelled "accounts only" by the caller: investments and debts have no dated
 * history, so this is cash + savings + other account balances.
 */
export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  return (
    <LineChart
      height={HEIGHT}
      grid={GRID}
      sx={LINE_SX}
      hideLegend
      xAxis={[{ scaleType: "point", data: data.map((row) => monthLabel(row.monthStart)) }]}
      yAxis={[{ valueFormatter: compact, width: 56 }]}
      series={[
        {
          data: data.map((row) => Number(row.accountTotal)),
          label: "Balance",
          color: tokens.primary,
          curve: "natural",
          area: true,
          showMark: false,
          valueFormatter: money,
        },
      ]}
    />
  );
}

/** Current balance per active account, as rounded horizontal bars. */
export function AccountBalancesChart({
  data,
}: {
  data: AccountWithBalance[];
}) {
  return (
    <BarChart
      layout="horizontal"
      height={Math.max(200, data.length * 48)}
      borderRadius={BAR_RADIUS}
      grid={{ vertical: true }}
      hideLegend
      yAxis={[
        {
          scaleType: "band",
          data: data.map((row) => row.name),
          width: 110,
          categoryGapRatio: 0.35,
          colorMap: {
            type: "ordinal",
            colors: data.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
          },
        },
      ]}
      xAxis={[{ valueFormatter: compact }]}
      series={[
        {
          data: data.map((row) => Number(row.current_balance)),
          label: "Balance",
          valueFormatter: money,
        },
      ]}
    />
  );
}
