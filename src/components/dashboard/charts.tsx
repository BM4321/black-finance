"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CategorySpending } from "@/lib/data/dashboard";
import { formatMoney } from "@/lib/finance/money";

/** Distinct, reasonably colour-blind-safe palette for category slices. */
const PALETTE = [
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

/** Recharts passes a loose ValueType; coerce defensively for display. */
function formatTooltipValue(value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? formatMoney(numeric) : "—";
}

/** "2026-01" -> "Jan 2026" without pulling in a date library. */
function monthLabel(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, 1));
  return date.toLocaleDateString("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function IncomeExpenseChart({
  data,
}: {
  data: Array<{ monthStart: string; income: string; expense: string }>;
}) {
  const chartData = data.map((row) => ({
    month: monthLabel(row.monthStart),
    Income: Number(row.income),
    Expenses: Number(row.expense),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ea" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(value: number) => compact(value)}
        />
        <Tooltip
          formatter={formatTooltipValue}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Income" fill="#12805c" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Expenses" fill="#c0392b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SpendingByCategoryChart({
  data,
}: {
  data: CategorySpending[];
}) {
  const chartData = data.map((row) => ({
    name: row.categoryName,
    value: Number(row.total),
    total: row.total,
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
        <Tooltip
          formatter={formatTooltipValue}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Compact axis labels (e.g. 1500000 -> 1.5M) to keep the Y axis narrow. */
function compact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}
