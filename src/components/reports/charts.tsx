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
import type {
  CategorySpending,
  MonthlySummary,
} from "@/lib/data/dashboard";
import type { NetWorthPoint } from "@/lib/data/reports";
import type { AccountWithBalance } from "@/lib/data/accounts";

/** "2026-01" -> "Jan 2026" without a date library. */
function monthLabel(iso: string): string {
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

/** Income vs expenses bars over the loaded months. */
export function IncomeExpenseChart({ data }: { data: MonthlySummary[] }) {
  const chartData = data.map((row) => ({
    month: monthLabel(row.monthStart),
    Income: Number(row.income),
    Expenses: Number(row.expense),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Income" fill="#12805c" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Expenses" fill="#c0392b" radius={[4, 4, 0, 0]} />
      </BarChart>
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
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Spending by category for a range. */
export function SpendingByCategoryChart({
  data,
}: {
  data: CategorySpending[];
}) {
  const chartData = data.map((row, index) => ({
    name: row.categoryName,
    value: Number(row.total),
    fill: PALETTE[index % PALETTE.length],
  }));

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
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
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
        <Bar dataKey="Balance" radius={[0, 4, 4, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Compact spending-by-category pie, used on the dashboard. */
export function SpendingPieChart({ data }: { data: CategorySpending[] }) {
  const chartData = data.map((row) => ({
    name: row.categoryName,
    value: Number(row.total),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {chartData.map((entry, index) => (
            <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip formatter={formatTooltipValue} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
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
