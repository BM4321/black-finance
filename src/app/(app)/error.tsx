"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the authenticated app.
 *
 * A missing table or transient database fault should show a recoverable screen,
 * not a raw stack trace. The message stays generic (no SQL details leaked to
 * the user); the full error is logged to the browser console for debugging.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const schemaMissing = /schema cache|does not exist|relation .* does not exist/i.test(
    error.message,
  );

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {schemaMissing ? "Database isn’t set up yet" : "Something went wrong"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {schemaMissing
          ? "The application tables don’t exist in your Supabase project yet. Apply the migrations, then try again."
          : "We couldn’t load your financial data. This is usually temporary."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
