import Link from "next/link";

import { archiveGoalAction } from "@/app/(app)/goals/actions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { listGoals, type GoalWithProgress } from "@/lib/data/goals";
import {
  classifyGoal,
  daysUntil,
  goalProgressWidth,
  type GoalStatus,
} from "@/lib/finance/goals";
import { formatMoney } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";
import { ProgressBar, type ProgressTone } from "@/components/ui/progress-bar";
import AddRounded from "@mui/icons-material/AddRounded";
import { LinkButton } from "@/components/ui/link-button";
import { StatCard } from "@/components/dashboard/stat-card";

export const metadata = { title: "Goals" };

const STATUS_TONE: Record<GoalStatus, ProgressTone> = {
  not_started: "neutral",
  in_progress: "primary",
  complete: "positive",
};

/** Friendly deadline summary: days left, or a completed/past marker. */
function deadlineLabel(targetDate: string | null): string | null {
  const days = daysUntil(targetDate);
  if (days === null) return null;
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} past`;
  if (days === 0) return "Due today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

function GoalCard({ goal }: { goal: GoalWithProgress }) {
  const status = classifyGoal(goal.percent_complete);
  const deadline = deadlineLabel(goal.target_date);

  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/goals/${goal.id}`}
          className="min-w-0 truncate text-sm font-medium hover:text-primary"
        >
          {goal.name}
        </Link>
        <span className="tabular-nums text-sm font-semibold">
          {formatMoney(goal.current_amount)}{" "}
          <span className="font-normal text-muted-foreground">
            / {formatMoney(goal.target_amount)}
          </span>
        </span>
      </div>

      <ProgressBar className="mt-2" value={goalProgressWidth(goal.percent_complete)} tone={STATUS_TONE[status]} />

      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {goal.percent_complete.toFixed(0)}% complete
          {deadline ? ` · ${deadline}` : ""}
        </span>
        <span className="text-muted-foreground">
          {status === "complete"
            ? "Goal reached"
            : `${formatMoney(goal.remaining)} to go`}
        </span>
      </div>
    </li>
  );
}

export default async function GoalsPage() {
  await requireUser();
  const supabase = await createClient();
  const { active, archived, totalSaved, totalTarget } = await listGoals(
    supabase,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals"
        subtitle="What you are saving toward."
        action={
          <LinkButton href="/goals/new" variant="primary" startIcon={<AddRounded />}>
            Add goal
          </LinkButton>
        }
      />

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Create a savings goal and track contributions toward it — a trip, a course, an emergency fund."
          action={
            <LinkButton href="/goals/new" variant="primary" startIcon={<AddRounded />}>
              Add goal
            </LinkButton>
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard label="Saved toward active goals" value={formatMoney(totalSaved)} tone="positive" />
              <StatCard label="Total target" value={formatMoney(totalTarget)} hint="Progress is derived from contributions, not account cash" />
            </div>
          )}

          {active.length > 0 && (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {active.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </ul>
            </Card>
          )}

          {archived.length > 0 && (
            <details className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-medium">
                Archived goals ({archived.length})
              </summary>
              <ul className="mt-3 divide-y divide-border">
                {archived.map((goal) => (
                  <li
                    key={goal.id}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <span className="truncate text-sm">{goal.name}</span>
                    <form action={archiveGoalAction}>
                      <input type="hidden" name="goalId" value={goal.id} />
                      <input type="hidden" name="archived" value="false" />
                      <SubmitButton variant="ghost" size="small">
                        Restore
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
