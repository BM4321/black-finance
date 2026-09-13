import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Retrieval layer contracts.
 *
 * The assistant is a retrieve-then-generate system: deterministic functions
 * gather facts from the user's own data, those facts become context, and Gemini
 * only interprets them. Gemini never computes a total.
 *
 * A `RetrievalProvider` is the extension point for future sources. Today every
 * provider reads structured Supabase/Postgres data. Later, a semantic/vector
 * provider can implement the same interface without touching the chat UI or
 * the Gemini call site.
 */

export type AiClient = SupabaseClient<Database>;

/** A single fact bundle injected into the prompt and reported in the UI. */
export type RetrievalSection = {
  /** Stable id, e.g. "accounts". */
  id: string;
  /** Human-readable title used when formatting context for the model. */
  title: string;
  /** What was used, for the transparency line ("18 transactions"). */
  source: {
    label: string;
    count: number;
  };
  /**
   * The facts to serialise into the prompt. Kept as JSON-serialisable data,
   * never as prose, so the model sees structured numbers.
   */
  data: unknown;
};

/** Everything retrieved for one question. */
export type FinancialContext = {
  sections: RetrievalSection[];
  /** Resolved period the question is about, for grounding and transparency. */
  period: {
    from: string;
    to: string;
    label: string;
  };
};

/** A retrieval source. Implementations must scope to the caller via RLS. */
export type RetrievalProvider = {
  id: string;
  /** Runs the provider against the authenticated client. */
  run: (
    supabase: AiClient,
    question: string,
    period: ResolvedPeriod,
  ) => Promise<RetrievalSection | null>;
};

export type ResolvedPeriod = {
  from: string;
  to: string;
  label: string;
};
