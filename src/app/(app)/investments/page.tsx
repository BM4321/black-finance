import Link from "next/link";

import { archiveHoldingAction } from "@/app/(app)/investments/actions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { listHoldings, type Holding } from "@/lib/data/investments";
import {
  classifyGain,
  formatReturn,
  returnOnCost,
} from "@/lib/finance/investments";
import { formatMoney } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";
import { ASSET_TYPE_LABELS } from "@/types/domain";

export const metadata = { title: "Investments" };

const GAIN_TONE = {
  gain: "text-positive",
  loss: "text-negative",
  flat: "text-muted-foreground",
} as const;

/** Signed, coloured gain for a single holding. */
function GainValue({ holding }: { holding: Holding }) {
  const kind = classifyGain(holding.gain);
  const magnitude = String(holding.gain).startsWith("-")
    ? String(holding.gain).slice(1)
    : String(holding.gain);
  const rate = formatReturn(returnOnCost(holding.gain, holding.cost_basis));

  return (
    <span className={`tabular-nums text-xs font-medium ${GAIN_TONE[kind]}`}>
      {kind === "flat" ? "No change" : `${formatMoney(magnitude)} ${kind === "gain" ? "gain" : "loss"}`}
      {kind !== "flat" && ` · ${rate}`}
    </span>
  );
}

function HoldingRow({ holding }: { holding: Holding }) {
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/investments/${holding.id}/edit`}
            className="truncate font-medium hover:text-primary"
          >
            {holding.name}
          </Link>
          {holding.is_archived && (
            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Archived
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {ASSET_TYPE_LABELS[holding.asset_type]} · {Number(holding.quantity)}{" "}
          units · cost {formatMoney(holding.cost_basis)}
        </span>
        <div className="mt-0.5">
          <GainValue holding={holding} />
        </div>
      </div>

      <div className="text-right">
        <span className="tabular-nums text-sm font-semibold">
          {formatMoney(holding.market_value)}
        </span>
        {holding.current_value === null && (
          <p className="text-[11px] text-muted-foreground">at cost</p>
        )}
      </div>

      <form action={archiveHoldingAction}>
        <input type="hidden" name="investmentId" value={holding.id} />
        <input
          type="hidden"
          name="archived"
          value={holding.is_archived ? "false" : "true"}
        />
        <SubmitButton variant="ghost" className="px-2 py-1 text-xs">
          {holding.is_archived ? "Restore" : "Archive"}
        </SubmitButton>
      </form>
    </li>
  );
}

export default async function InvestmentsPage() {
  await requireUser();
  const supabase = await createClient();
  const { active, archived, totalValue, totalCost, totalGain } =
    await listHoldings(supabase);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        subtitle="What you own, and what it is worth."
        action={
          <Link
            href="/investments/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Add investment
          </Link>
        }
      />

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          title="No investments yet"
          description="Track stocks, bonds, funds, crypto or property. Set a current value manually; it counts toward your net worth."
          action={
            <Link
              href="/investments/new"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Add investment
            </Link>
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card className="px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Portfolio value
                </span>
                <p className="tabular-nums text-lg font-semibold">
                  {formatMoney(totalValue)}
                </p>
              </Card>
              <Card className="px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total cost
                </span>
                <p className="tabular-nums text-lg font-semibold">
                  {formatMoney(totalCost)}
                </p>
              </Card>
              <Card className="px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total gain / loss
                </span>
                <p
                  className={`tabular-nums text-lg font-semibold ${
                    GAIN_TONE[classifyGain(totalGain)]
                  }`}
                >
                  {classifyGain(totalGain) === "loss" ? "-" : ""}
                  {formatMoney(
                    totalGain.startsWith("-") ? totalGain.slice(1) : totalGain,
                  )}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {formatReturn(returnOnCost(totalGain, totalCost))} on cost
                </span>
              </Card>
            </div>
          )}

          {active.length > 0 && (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {active.map((holding) => (
                  <HoldingRow key={holding.id} holding={holding} />
                ))}
              </ul>
            </Card>
          )}

          {archived.length > 0 && (
            <details className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-medium">
                Archived investments ({archived.length})
              </summary>
              <ul className="mt-3 divide-y divide-border">
                {archived.map((holding) => (
                  <HoldingRow key={holding.id} holding={holding} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
