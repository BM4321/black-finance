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
import AddRounded from "@mui/icons-material/AddRounded";
import { LinkButton } from "@/components/ui/link-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Investments" };

const STAT_TONE = {
  gain: "positive",
  loss: "negative",
  flat: "muted",
} as const;

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
            <Badge>Archived</Badge>
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
        <SubmitButton variant="ghost" size="small">
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
          <LinkButton href="/investments/new" variant="primary" startIcon={<AddRounded />}>
            Add investment
          </LinkButton>
        }
      />

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          title="No investments yet"
          description="Track stocks, bonds, funds, crypto or property. Set a current value manually; it counts toward your net worth."
          action={
            <LinkButton href="/investments/new" variant="primary" startIcon={<AddRounded />}>
              Add investment
            </LinkButton>
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Portfolio value" value={formatMoney(totalValue)} />
              <StatCard label="Total cost" value={formatMoney(totalCost)} />
              <StatCard
                label="Total gain / loss"
                value={`${classifyGain(totalGain) === "loss" ? "-" : ""}${formatMoney(
                  totalGain.startsWith("-") ? totalGain.slice(1) : totalGain,
                )}`}
                hint={`${formatReturn(returnOnCost(totalGain, totalCost))} on cost`}
                tone={STAT_TONE[classifyGain(totalGain)]}
              />
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
