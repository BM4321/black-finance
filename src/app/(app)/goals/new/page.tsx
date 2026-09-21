import Link from "next/link";

import { createGoalAction } from "@/app/(app)/goals/actions";
import { GoalForm } from "@/components/goals/goal-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "New goal" };

export default async function NewGoalPage() {
  await requireUser();

  return (
    <div className="max-w-xl">
      <PageHeader title="Add goal" />
      <GoalForm action={createGoalAction} submitLabel="Create goal" />
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/goals" className="font-medium text-primary">
          Cancel
        </Link>
      </p>
    </div>
  );
}
