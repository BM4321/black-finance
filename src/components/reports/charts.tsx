"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { savingsRateSeries } from "@/lib/finance/reports";
import { formatMoney } from "@/lib/finance/money";
import type { CategorySpending, MonthlySummary } from "@/lib/data/dashboard";
import type { NetWorthPoint } from "@/lib/data/reports";
import type { AccountWithBalance } from "@/lib/data/accounts";
import type {
  IncomeChartType,
  SpendingChartType,
} from "@/lib/ui/chart-preferences";

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

function compact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

function formatTooltipValue(value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? formatMoney(numeric) : "—";
}

/** Distinct, reasonably colour-blind-safe palette. */
export const PALETTE = [
  "#1f6feb",
  "#12805c",
  "#b7791f",
  "#8250df",
  "#c0392b",
  "#0f766e",
  "#9333ea",
  "#ca8a04",
  "#2563eb",
  "#be185d",
];

/** Shared animation timing so every chart moves at the same tempo. */
const ANIM = { isAnimationActive: true, animationDuration: 700 } as const;

/**
 * Income vs expenses, in the chosen style.
 *
 * Three renderings of the same data so the user can pick what reads best for
 * them: grouped bars (compare), lines (trend), or a stacked area (volume).
 */
export function IncomeExpenseChart({
  data,
  variant = "bar",
}: {
  data: MonthlySummary[];
  variant?: IncomeChartType;
}) {
  const chartData = data.map((row) => ({
    month: monthLabel(row.monthStart),
    Income: Number(row.income),
    Expenses: Number(row.expense),
  }));

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ea" vertical={false} />
      <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
      <YAxis
        tick={{ fontSize: 12 }}
        tickLine={false}
        axisLine={false}
        width={70}
        tickFormatter={compact}
      />
      <Tooltip
        formatter={formatTooltipValue}
        contentStyle={{ fontSize: 12, borderRadius: 8 }}
      />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      {variant === "line" ? (
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          {axes}
          <Line
            type="monotone"
            dataKey="Income"
            stroke="#12805c"
            strokeWidth={2}
            dot={{ r: 3 }}
            {...ANIM}
          />
          <Line
            type="monotone"
            dataKey="Expenses"
            stroke="#c0392b"
            strokeWidth={2}
            dot={{ r: 3 }}
            {...ANIM}
          />
        </LineChart>
      ) : variant === "area" ? (
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#12805c" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#12805c" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#c0392b" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#c0392b" stopOpacity={0} />
            </linearGradient>
          </defs>
          {axes}
          <Area
            type="monotone"
            dataKey="Income"
            stroke="#12805c"
            strokeWidth={2}
            fill="url(#incomeFill)"
            {...ANIM}
          />
          <Area
            type="monotone"
            dataKey="Expenses"
            stroke="#c0392b"
            strokeWidth={2}
            fill="url(#expenseFill)"
            {...ANIM}
          />
        </AreaChart>
      ) : (
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          {axes}
          <Bar dataKey="Income" fill="#12805c" radius={[4, 4, 0, 0]} {...ANIM} />
          <Bar dataKey="Expenses" fill="#c0392b" radius={[4, 4, 0, 0]} {...ANIM} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

/**
 * Spending by category, in the chosen style.
 *
 * `list` renders plain rows (no chart library) which is also the most
 * screen-reader- and small-screen-friendly option.
 */
export function SpendingChart({
  data,
  variant = "pie",
}: {
  data: CategorySpending[];
  variant?: SpendingChartType;
}) {
  const chartData = data.map((row, index) => ({
    name: row.categoryName,
    value: Number(row.total),
    total: row.total,
    fill: PALETTE[index % PALETTE.length],
  }));

  if (variant === "list") {
    const max = chartData.reduce((acc, row) => Math.max(acc, row.value), 0);
    return (
      <ul className="space-y-3">
        {chartData.map((row) => (
          <li key={row.name}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="truncate">{row.name}</span>
              <span className="tabular-nums font-medium">
                {formatMoney(row.total)}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${max === 0 ? 0 : (row.value / max) * 100}%`,
                  backgroundColor: row.fill,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (variant === "bar") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ea" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} tickFormatter={compact} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={110}
          />
          <Tooltip formatter={formatTooltipValue} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} {...ANIM}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          {...ANIM}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip formatter={formatTooltipValue} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/**
 * Savings rate line over time.
 *
 * Months with no income have a null rate and are rendered as gaps (connectNulls
 * is off), so a zero-income month does not draw a misleading 0%.
 */
export function SavingsRateChart({ data }: { data: MonthlySummary[] }) {
  const series = savingsRateSeries(data);
  const chartData = series.map((point) => ({
    month: monthLabel(point.monthStart),
    Rate: point.rate === null ? null : Number((point.rate * 100).toFixed(1)),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ea" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={50}
          tickFormatter={(value: number) => `${value}%`}
        />
        <ReferenceLine y={0} stroke="#9aa4b2" />
        <Tooltip
          formatter={(value: unknown) =>
            typeof value === "number" ? `${value}%` : "—"
          }
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Line
          type="monotone"
          dataKey="Rate"
          stroke="#1f6feb"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls={false}
          {...ANIM}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Account-only net worth over time.
 *
 * Labelled "accounts only" by the caller: investments and debts have no dated
 * history, so this is cash + savings + other account balances.
 */
export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  const chartData = data.map((row) => ({
    month: monthLabel(row.monthStart),
    Balance: Number(row.accountTotal),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1f6feb" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#1f6feb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ea" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={compact}
        />
        <Tooltip formatter={formatTooltipValue} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Area
          type="monotone"
          dataKey="Balance"
          stroke="#1f6feb"
          strokeWidth={2}
          fill="url(#netWorthFill)"
          {...ANIM}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Current balance per active account. */
export function AccountBalancesChart({
  data,
}: {
  data: AccountWithBalance[];
}) {
  const chartData = data.map((row, index) => ({
    name: row.name,
    Balance: Number(row.current_balance),
    fill: PALETTE[index % PALETTE.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 48)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ea" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} tickFormatter={compact} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip formatter={formatTooltipValue} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="Balance" radius={[0, 4, 4, 0]} {...ANIM}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
