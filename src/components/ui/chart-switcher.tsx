"use client";

import { useEffect, useState } from "react";

import {
  chartPreferenceKey,
  resolveChartType,
} from "@/lib/ui/chart-preferences";

export type ChartOption<T extends string> = {
  value: T;
  label: string;
};

/**
 * Segmented control for choosing how a chart is drawn.
 *
 * Renders as a radiogroup for accessibility. The selected value is persisted to
 * `localStorage` under a per-chart key so the preference survives reloads. The
 * initial render always uses the default and the stored value is applied in an
 * effect, which avoids a server/client hydration mismatch (the server has no
 * access to localStorage).
 */
export function ChartSwitcher<T extends string>({
  chartId,
  options,
  value,
  onChange,
  label = "Chart type",
}: {
  chartId: string;
  options: readonly ChartOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  // Apply any stored preference once, on mount. Defaults render first so the
  // markup matches the server.
  useEffect(() => {
    const stored = window.localStorage.getItem(chartPreferenceKey(chartId));
    const resolved = resolveChartType(
      stored,
      options.map((option) => option.value),
      value,
    );
    if (resolved !== value) onChange(resolved);
    // Intentionally run once per chartId; `value`/`onChange` are stable enough
    // for this one-shot hydration of a saved preference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartId]);

  function select(next: T) {
    onChange(next);
    try {
      window.localStorage.setItem(chartPreferenceKey(chartId), next);
    } catch {
      // localStorage can be unavailable (private mode, quota). The choice
      // still applies for this session; persistence is a bonus.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-lg bg-surface-muted p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => select(option.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              selected
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Convenience hook: manage a chart type with persistence.
 *
 * Returns the current value and a setter. Hydration of the stored value is
 * handled by `ChartSwitcher`, so callers only need this for the state itself.
 */
export function useChartType<T extends string>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  return [value, setValue] as const;
}
