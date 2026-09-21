import Link from "next/link";
import { notFound } from "next/navigation";

import { updateGoalAction } from "@/app/(app)/goals/actions";
import { GoalForm } from "@/components/goals/goal-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getGoal } from "@/lib/data/goals";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit goal" };

export default async function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const supabase = await createClient();
  const goal = await getGoal(supabase, id);
  if (!goal) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="Edit goal" />
      <GoalForm
        action={updateGoalAction}
        goalId={goal.id}
        initial={{
          name: goal.name,
          targetAmount: String(goal.target_amount),
          targetDate: goal.target_date ?? "",
          notes: goal.notes ?? "",
        }}
        submitLabel="Save changes"
      />
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href={`/goals/${goal.id}`} className="font-medium text-primary">
          Cancel
        </Link>
      </p>
    </div>
  );
}
