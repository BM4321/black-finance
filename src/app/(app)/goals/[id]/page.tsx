import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addContributionAction,
  archiveGoalAction,
  deleteContributionAction,
  deleteGoalAction,
} from "@/app/(app)/goals/actions";
import { ContributionForm } from "@/components/goals/contribution-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmSubmitButton, SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { getGoal, listContributions } from "@/lib/data/goals";
import {
  classifyGoal,
  daysUntil,
  goalProgressWidth,
  monthlyPace,
  type GoalStatus,
} from "@/lib/finance/goals";
import { formatMoney } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Goal" };

const STATUS_BAR: Record<GoalStatus, string> = {
  not_started: "bg-surface-muted",
  in_progress: "bg-primary",
  complete: "bg-positive",
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const supabase = await createClient();
  const goal = await getGoal(supabase, id);
  if (!goal) notFound();

  const contributions = await listContributions(supabase, id);
  const status = classifyGoal(goal.percent_complete);
  const days = daysUntil(goal.target_date);
  const pace = monthlyPace(goal.remaining, goal.target_date);

  return (
    <div className="space-y-6">
      <PageHeader
        title={goal.name}
        subtitle={goal.notes ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/goals/${goal.id}/edit`}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              Edit
            </Link>
            <form action={archiveGoalAction}>
              <input type="hidden" name="goalId" value={goal.id} />
              <input
                type="hidden"
                name="archived"
                value={goal.is_archived ? "false" : "true"}
              />
              <SubmitButton variant="secondary">
                {goal.is_archived ? "Restore" : "Archive"}
              </SubmitButton>
            </form>
          </div>
        }
      />

      {goal.is_archived && (
        <p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
          This goal is archived. Restore it to keep contributing.
        </p>
      )}

      {/* Progress ------------------------------------------------------- */}
      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {formatMoney(goal.current_amount)} of{" "}
            {formatMoney(goal.target_amount)}
          </span>
          <span className="tabular-nums text-sm font-semibold">
            {goal.percent_complete.toFixed(0)}%
          </span>
        </div>

        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className={`h-full rounded-full ${STATUS_BAR[status]}`}
            style={{ width: `${goalProgressWidth(goal.percent_complete)}%` }}
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Remaining</dt>
            <dd className="tabular-nums font-semibold">
              {formatMoney(goal.remaining)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Target date</dt>
            <dd className="font-medium">
              {goal.target_date ? formatDate(goal.target_date) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Time left</dt>
            <dd className="font-medium">
              {days === null
                ? "—"
                : days < 0
                  ? "Past due"
                  : `${days} day${days === 1 ? "" : "s"}`}
            </dd>
          </div>
        </dl>

        {pace && status !== "complete" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Save about {formatMoney(pace)} per month to reach this goal on time.
          </p>
        )}
      </Card>

      {/* Add a contribution --------------------------------------------- */}
      {!goal.is_archived && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Add a contribution</h2>
          <ContributionForm action={addContributionAction} goalId={goal.id} />
        </Card>
      )}

      {/* Contribution history ------------------------------------------- */}
      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">
            Contributions ({contributions.length})
          </h2>
        </div>

        {contributions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No contributions yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {contributions.map((contribution) => (
              <li
                key={contribution.id}
                className="flex items-center gap-4 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">
                    {formatMoney(contribution.amount)}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(contribution.contributed_on)}
                    {contribution.note ? ` · ${contribution.note}` : ""}
                  </p>
                </div>
                <form action={deleteContributionAction}>
                  <input type="hidden" name="goalId" value={goal.id} />
                  <input
                    type="hidden"
                    name="contributionId"
                    value={contribution.id}
                  />
                  <ConfirmSubmitButton
                    confirmText="Remove this contribution? The goal progress will be recalculated."
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                  >
                    Remove
                  </ConfirmSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Danger zone ---------------------------------------------------- */}
      <div className="flex items-center justify-between rounded-xl border border-negative/30 bg-negative/5 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-negative">Delete this goal</p>
          <p className="text-xs text-muted-foreground">
            Permanently deletes the goal and its entire contribution history.
          </p>
        </div>
        <form action={deleteGoalAction}>
          <input type="hidden" name="goalId" value={goal.id} />
          <ConfirmSubmitButton
            confirmText="Delete this goal and all of its contributions? This cannot be undone."
            variant="danger"
          >
            Delete
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}
