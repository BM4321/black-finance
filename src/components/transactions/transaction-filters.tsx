"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AccountWithBalance } from "@/lib/data/accounts";
import type { Category } from "@/types/domain";
import { TRANSACTION_TYPE_LABELS } from "@/types/domain";

/**
 * Transaction filters.
 *
 * State lives in the URL, not React: the server component reads searchParams
 * and queries the database directly. This keeps filtering server-rendered,
 * shareable/bookmarkable, and avoids shipping the whole table to the browser.
 */
export function TransactionFilters({
  accounts,
  categories,
}: {
  accounts: AccountWithBalance[];
  categories: Category[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const get = (key: string) => params.get(key) ?? "";

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page"); // any filter change resets to page 1
    startTransition(() => {
      router.push(`/transactions?${next.toString()}`);
    });
  }

  function clear() {
    startTransition(() => router.push("/transactions"));
  }

  const hasFilters =
    get("search") ||
    get("type") ||
    get("account") ||
    get("category") ||
    get("from") ||
    get("to") ||
    get("min") ||
    get("max");

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        update({
          search: String(data.get("search") ?? ""),
          type: String(data.get("type") ?? ""),
          account: String(data.get("account") ?? ""),
          category: String(data.get("category") ?? ""),
          from: String(data.get("from") ?? ""),
          to: String(data.get("to") ?? ""),
          min: String(data.get("min") ?? ""),
          max: String(data.get("max") ?? ""),
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            name="search"
            type="search"
            placeholder="Description or payee…"
            defaultValue={get("search")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue={get("type")}>
            <option value="">All types</option>
            {(["income", "expense", "transfer"] as const).map((type) => (
              <option key={type} value={type}>
                {TRANSACTION_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="account">Account</Label>
          <Select id="account" name="account" defaultValue={get("account")}>
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.account_id} value={account.account_id}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" defaultValue={get("category")}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.kind})
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="min">Min amount</Label>
          <Input
            id="min"
            name="min"
            inputMode="decimal"
            placeholder="0"
            defaultValue={get("min")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="from">From date</Label>
          <Input id="from" name="from" type="date" defaultValue={get("from")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="to">To date</Label>
          <Input id="to" name="to" type="date" defaultValue={get("to")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="max">Max amount</Label>
          <Input
            id="max"
            name="max"
            inputMode="decimal"
            placeholder="Any"
            defaultValue={get("max")}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Filtering…" : "Apply filters"}
        </Button>
        {hasFilters && (
          <Button type="button" variant="secondary" onClick={clear}>
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
