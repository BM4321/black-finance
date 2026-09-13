import "server-only";

/**
 * Server-only configuration for the AI assistant.
 *
 * `server-only` makes the build fail if this module is ever imported from a
 * Client Component, so the Gemini API key cannot leak into the browser bundle.
 *
 * The key is read lazily (via a function) rather than at module load, so a
 * missing key only disables the assistant instead of breaking the whole app
 * build for users who don't use the feature.
 */

/**
 * Model used for the assistant.
 *
 * Google periodically retires models for new API keys (a retired model returns
 * HTTP 404 NOT_FOUND). The default is the current flash model, but it can be
 * overridden with GEMINI_MODEL without a code change, so a future retirement
 * is a one-line env fix rather than a deploy.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

/**
 * Returns the Gemini API key or throws a safe, non-secret-bearing error.
 *
 * The message deliberately does not echo any environment value.
 */
export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error(
      "The AI assistant is not configured. Set GEMINI_API_KEY in the environment.",
    );
  }
  return key;
}

/** True when the assistant is configured (used for UI affordances only). */
export function isAssistantConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
