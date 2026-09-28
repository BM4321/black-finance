"use client";

import CloseRounded from "@mui/icons-material/CloseRounded";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useActionState, useMemo, useState } from "react";

import type { BudgetActionState } from "@/app/(app)/budgets/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import type { BudgetStatusRow } from "@/lib/data/budgets";
import {
  addDays,
  calendarPeriod,
  customPeriodError,
  defaultCustomEnd,
  formatPeriod,
  MAX_PERIOD_DAYS,
  type BudgetPeriod,
  type BudgetPeriodType,
} from "@/lib/finance/budget-periods";
import {
  sumBudgetInputs,
  unallocated as computeUnallocated,
} from "@/lib/finance/budgets";
import { formatMoney } from "@/lib/finance/money";
import type { Category } from "@/types/domain";

type Action = (
  state: BudgetActionState,
  formData: FormData,
) => Promise<BudgetActionState>;

type Row = { key: string; categoryId: string; amount: string };

let rowCounter = 0;
function nextKey(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

/**
 * Budget editor.
 *
 * Rows are managed in local state so items can be added and removed, and the
 * running total is computed live as amounts are typed. The planning field lets
 * the user compare their allocation against money they have or expect, which
 * is the whole point of the total.
 *
 * The period picker chooses between a calendar month and custom dates (e.g.
 * payday to payday). A custom period may start in an earlier month (the
 * October budget can run 24 Sep – 25 Oct) as long as it includes a day of the
 * budget's month; the end follows the start (one month less a day) until the
 * user sets it themselves.
 *
 * On submit, each row contributes one `categoryId` and one `amount`, which the
 * Server Action zips back together.
 */
export function BudgetForm({
  action,
  categories,
  existing,
  periodMonth,
  period,
}: {
  action: Action;
  categories: Category[];
  existing: BudgetStatusRow[];
  periodMonth: string;
  /** The saved period, or the suggested one for a new budget. */
  period: BudgetPeriod;
}) {
  const [state, formAction] = useActionState(action, {});

  const monthPeriod = calendarPeriod(periodMonth);
  const [periodType, setPeriodType] = useState<BudgetPeriodType>(period.type);
  const [startDate, setStartDate] = useState(
    period.type === "custom" ? period.start : monthPeriod.start,
  );
  const [endDate, setEndDate] = useState(
    period.type === "custom" ? period.end : defaultCustomEnd(monthPeriod.start),
  );
  // Until the user edits the end date, it follows the start date.
  const [endTouched, setEndTouched] = useState(period.type === "custom");

  const periodError =
    periodType === "custom" ? customPeriodError(periodMonth, startDate, endDate) : null;
  const shownPeriod = periodType === "custom" ? { start: startDate, end: endDate } : monthPeriod;

  function changeStart(value: string) {
    setStartDate(value);
    if (!endTouched && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setEndDate(defaultCustomEnd(value));
    }
  }

  // Start with the categories already budgeted, or one blank row to invite
  // entry when the budget is empty.
  const [rows, setRows] = useState<Row[]>(() => {
    if (existing.length > 0) {
      return existing.map((row) => ({
        key: nextKey(),
        categoryId: row.categoryId,
        amount: row.budgeted,
      }));
    }
    return [{ key: nextKey(), categoryId: categories[0]?.id ?? "", amount: "" }];
  });

  const [planning, setPlanning] = useState("");

  const usedCategoryIds = new Set(rows.map((row) => row.categoryId));
  const availableCategories = categories.filter(
    (category) => !usedCategoryIds.has(category.id),
  );

  const spentByCategory = new Map(
    existing.map((row) => [row.categoryId, row.spent]),
  );

  const total = useMemo(
    () => sumBudgetInputs(rows.map((row) => row.amount)),
    [rows],
  );
  const unallocated = planning.trim() === "" ? null : computeUnallocated(planning, total);

  function updateRow(key: string, changes: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    );
  }

  function addRow() {
    const nextCategory = availableCategories[0];
    if (!nextCategory) return;
    setRows((current) => [
      ...current,
      { key: nextKey(), categoryId: nextCategory.id, amount: "" },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.formError && (
        <FormMessage kind="error">{state.formError}</FormMessage>
      )}

      <input type="hidden" name="periodMonth" value={periodMonth} />
      <input type="hidden" name="periodType" value={periodType} />
      {periodType === "custom" && (
        <>
          <input type="hidden" name="startDate" value={startDate} />
          <input type="hidden" name="endDate" value={endDate} />
        </>
      )}

      {/* Budget period ------------------------------------------------- */}
      <fieldset className="space-y-3 rounded-xl border border-border p-4" data-tour="budget-period">
        <legend className="px-1 text-sm font-medium">Budget period</legend>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={periodType}
          onChange={(_, next: BudgetPeriodType | null) => {
            if (next) setPeriodType(next);
          }}
          aria-label="Budget period"
        >
          <ToggleButton value="calendar" sx={{ py: 0.75 }}>
            Calendar month
          </ToggleButton>
          <ToggleButton value="custom" sx={{ py: 0.75 }}>
            Custom dates
          </ToggleButton>
        </ToggleButtonGroup>

        {periodType === "custom" && (
          <div className="animate-fade-in grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="budget-start">Starts on</Label>
              <Input
                id="budget-start"
                type="date"
                value={startDate}
                min={addDays(monthPeriod.start, -MAX_PERIOD_DAYS)}
                max={monthPeriod.end}
                onChange={(event) => changeStart(event.target.value)}
                invalid={Boolean(periodError)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-end">Ends on</Label>
              <Input
                id="budget-end"
                type="date"
                value={endDate}
                min={startDate > monthPeriod.start ? startDate : monthPeriod.start}
                max={/^\d{4}-\d{2}-\d{2}$/.test(startDate) ? addDays(startDate, MAX_PERIOD_DAYS) : undefined}
                onChange={(event) => {
                  setEndTouched(true);
                  setEndDate(event.target.value);
                }}
                invalid={Boolean(periodError)}
              />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground" role={periodError ? "alert" : undefined}>
          {periodError ? (
            <span className="text-negative">{periodError}</span>
          ) : periodType === "custom" ? (
            <>
              Counts expenses from <strong>{formatPeriod(shownPeriod)}</strong>. Pick the
              day your salary lands, even if it’s in the previous month; the end defaults
              to the day before the next one.
            </>
          ) : (
            <>
              Counts expenses from <strong>{formatPeriod(shownPeriod)}</strong>.
            </>
          )}
        </p>
      </fieldset>

      <div className="space-y-2" data-tour="budget-items">
        {rows.map((row) => {
          const spent = spentByCategory.get(row.categoryId);
          return (
            <div key={row.key} className="space-y-1">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <Select
                  name="categoryId"
                  value={row.categoryId}
                  onChange={(event) =>
                    updateRow(row.key, { categoryId: event.target.value })
                  }
                  aria-label="Category"
                >
                  {categories
                    .filter(
                      (category) =>
                        category.id === row.categoryId ||
                        !usedCategoryIds.has(category.id),
                    )
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </Select>

                <Input
                  name="amount"
                  inputMode="decimal"
                  placeholder="0"
                  value={row.amount}
                  onChange={(event) =>
                    updateRow(row.key, { amount: event.target.value })
                  }
                  aria-label="Budgeted amount"
                  className="w-32 text-right tabular-nums sm:w-40"
                />

                <IconButton
                  onClick={() => removeRow(row.key)}
                  aria-label="Remove item"
                  size="small"
                >
                  <CloseRounded fontSize="small" />
                </IconButton>
              </div>
              {spent !== undefined && (
                <p className="pl-1 text-xs text-muted-foreground">
                  Spent so far: {formatMoney(spent)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={addRow}
        disabled={availableCategories.length === 0}
      >
        + Add item
      </Button>

      {/* Planning + live total ---------------------------------------- */}
      <div className="space-y-3 rounded-xl border border-border bg-surface-muted/50 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="planning">Money available or expected</Label>
          <Input
            id="planning"
            name="planning"
            inputMode="decimal"
            placeholder="Optional — e.g. this month’s income"
            value={planning}
            onChange={(event) => setPlanning(event.target.value)}
            className="max-w-xs text-right tabular-nums"
          />
          <p className="text-xs text-muted-foreground">
            Used only to check your plan while you type. It is not saved.
          </p>
        </div>

        <dl className="space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Total budgeted</dt>
            <dd className="tabular-nums text-base font-semibold">
              {formatMoney(total)}
            </dd>
          </div>
          {unallocated !== null && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Unallocated</dt>
              <dd
                className={`tabular-nums text-base font-semibold ${
                  Number(unallocated) < 0 ? "text-negative" : "text-positive"
                }`}
              >
                {formatMoney(unallocated)}
              </dd>
            </div>
          )}
          {unallocated !== null && Number(unallocated) < 0 && (
            <p role="status" className="text-xs text-negative">
              You have budgeted more than the amount available.
            </p>
          )}
        </dl>
      </div>

      <SubmitButton pendingText="Saving…" disabled={Boolean(periodError)}>
        Save budget
      </SubmitButton>
    </form>
  );
}
