import { resolvePeriod } from "./period";
import { ALL_PROVIDERS } from "./providers";
import type { AiClient, FinancialContext, RetrievalSection } from "./types";

/**
 * Runs every retrieval provider for a question and assembles the context.
 *
 * Providers run concurrently. A provider that fails does not fail the whole
 * request: its section is dropped and the assistant is told, via the assembled
 * context, that that source was unavailable. This keeps a single bad query from
 * producing a misleading "I can't help" for the whole question.
 *
 * The result is the complete set of facts the model is allowed to use.
 */
export async function retrieveFinancialContext(
  supabase: AiClient,
  question: string,
  now = new Date(),
): Promise<FinancialContext> {
  const period = resolvePeriod(question, now);

  const settled = await Promise.allSettled(
    ALL_PROVIDERS.map((provider) => provider.run(supabase, question, period)),
  );

  const sections: RetrievalSection[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      sections.push(result.value);
    }
    // A rejected provider is intentionally skipped and not surfaced verbatim,
    // so internal error details are never exposed to the user.
  }

  return { sections, period };
}
