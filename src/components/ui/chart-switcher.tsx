"use client";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
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
 * Segmented control for choosing how a chart is drawn, built on Material UI's
 * ToggleButtonGroup (exclusive, so it behaves as a single choice).
 *
 * The selected value is persisted to `localStorage` under a per-chart key so
 * the preference survives reloads. The initial render always uses the default
 * and the stored value is applied in an effect, which avoids a server/client
 * hydration mismatch (the server has no access to localStorage).
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

  function select(next: T | null) {
    // Exclusive groups report null when the active button is clicked again;
    // keep the current choice rather than clearing it.
    if (next === null) return;
    onChange(next);
    try {
      window.localStorage.setItem(chartPreferenceKey(chartId), next);
    } catch {
      // localStorage can be unavailable (private mode, quota). The choice
      // still applies for this session; persistence is a bonus.
    }
  }

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, next: T | null) => select(next)}
      aria-label={label}
    >
      {options.map((option) => (
        <ToggleButton key={option.value} value={option.value} sx={{ fontSize: 12 }}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
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
