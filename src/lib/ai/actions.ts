"use server";

import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { isAssistantConfigured } from "@/lib/ai/config";
import { AssistantError, generateAnswer } from "@/lib/ai/gemini";
import { retrieveFinancialContext } from "@/lib/ai/retrieval";
import { describeSources } from "@/lib/ai/sources";
import { createClient } from "@/lib/supabase/server";

/**
 * The assistant's only entry point.
 *
 * Security model:
 *   - requireUser() establishes the authenticated identity from the session
 *     cookie. The client never supplies a user id, and none is accepted.
 *   - Every retrieval uses the request-scoped Supabase client, which carries
 *     that user's JWT, so Row Level Security restricts every query to their
 *     own rows.
 *   - The Gemini key is read inside server-only modules; nothing here is
 *     exposed to the browser.
 */

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

const askSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Ask a question first.")
    .max(1000, "That question is too long."),
  // Current-session history only. Not persisted anywhere.
  history: z.array(messageSchema).max(20).default([]),
});

export type AssistantSource = {
  label: string;
  count: number;
};

export type AskResult =
  | {
      ok: true;
      answer: string;
      sourceSummary: string;
      sources: AssistantSource[];
      periodLabel: string;
    }
  | {
      ok: false;
      error: string;
    };

export async function askAssistant(input: {
  question: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<AskResult> {
  // 1. Authenticate. Identity comes from the session, never the request body.
  await requireUser();

  if (!isAssistantConfigured()) {
    return {
      ok: false,
      error:
        "The assistant is not configured yet. Add GEMINI_API_KEY to the environment.",
    };
  }

  const parsed = askSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid question.",
    };
  }

  // 2. Retrieve the authenticated user's data via RLS-scoped queries.
  const supabase = await createClient();

  let context;
  try {
    context = await retrieveFinancialContext(supabase, parsed.data.question);
  } catch {
    return {
      ok: false,
      error: "Could not load your financial data. Please try again.",
    };
  }

  // 3. Ask Gemini to interpret the retrieved facts only.
  try {
    const answer = await generateAnswer(
      parsed.data.history,
      context,
      parsed.data.question,
    );

    return {
      ok: true,
      answer,
      sourceSummary: describeSources(context),
      sources: context.sections.map((section) => ({
        label: section.source.label,
        count: section.source.count,
      })),
      periodLabel: context.period.label,
    };
  } catch (error) {
    if (error instanceof AssistantError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: "The assistant could not answer right now. Please try again.",
    };
  }
}
