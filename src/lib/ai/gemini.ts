import "server-only";

import { GoogleGenAI } from "@google/genai";

import { GEMINI_MODEL, getGeminiApiKey } from "./config";
import { SYSTEM_INSTRUCTION, buildContents } from "./prompt";
import type { FinancialContext } from "./retrieval/types";

/**
 * Thin Gemini client wrapper.
 *
 * Everything in this module is server-only. The wrapper's job is to keep the
 * SDK details, error handling and response extraction in one place so the
 * Server Action stays readable and no secret can leak into a response.
 */

export class AssistantError extends Error {
  constructor(
    message: string,
    /** Whether the user could reasonably retry. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AssistantError";
  }
}

export async function generateAnswer(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  context: FinancialContext,
  question: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });

  const contents = buildContents(history, context, question);

  let responseText: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        // Low temperature: this is an interpretation task over exact figures,
        // not a creative one.
        temperature: 0.2,
        // Keep responses tight and cheap.
        maxOutputTokens: 1024,
      },
    });
    responseText = response.text;
  } catch (error) {
    // Log the underlying cause for operators. This may include the model name
    // and status code, but never the API key or user financial data.
    console.error(
      "[assistant] Gemini request failed:",
      error instanceof Error ? error.message : error,
    );
    // Never surface raw provider errors to the user: they can include request
    // metadata. Map to a safe message instead.
    throw toAssistantError(error);
  }

  if (!responseText || responseText.trim() === "") {
    throw new AssistantError(
      "The assistant returned an empty response. Please try rephrasing your question.",
      true,
    );
  }

  return responseText.trim();
}

/**
 * Map provider errors to safe, user-facing messages.
 *
 * Known status codes get specific wording; everything else collapses to a
 * generic message so no internal detail or credential can be echoed back.
 */
function toAssistantError(error: unknown): AssistantError {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  switch (status) {
    case 400:
      return new AssistantError(
        "The assistant could not process that request. Try rephrasing it.",
        true,
      );
    case 401:
    case 403:
      return new AssistantError(
        "The assistant is not configured correctly. Please contact support.",
        false,
      );
    case 404:
      // Almost always a retired or unknown model name. This is a configuration
      // problem, not a transient one, so retrying will not help.
      return new AssistantError(
        "The assistant's model is unavailable. An administrator needs to check the GEMINI_MODEL setting.",
        false,
      );
    case 429:
      return new AssistantError(
        "The assistant is receiving too many requests right now. Please try again shortly.",
        true,
      );
    case 500:
    case 503:
      return new AssistantError(
        "The assistant is temporarily unavailable. Please try again.",
        true,
      );
    default:
      return new AssistantError(
        "The assistant could not answer right now. Please try again.",
        true,
      );
  }
}
