import type { FinancialContext } from "./retrieval/types";

/**
 * Build the transparency line shown under an answer, e.g.
 * "Based on 18 transactions, 4 budget items and 2 accounts."
 *
 * Only the human-readable labels and counts are used; nothing about the
 * implementation is exposed. Zero-count sources are omitted.
 */
export function describeSources(context: FinancialContext): string {
  const parts = context.sections
    .filter((section) => section.source.count > 0)
    .map((section) => `${section.source.count} ${section.source.label}`);

  if (parts.length === 0) {
    return "No matching data was found for this question.";
  }

  if (parts.length === 1) {
    return `Based on ${parts[0]}.`;
  }

  const last = parts.pop();
  return `Based on ${parts.join(", ")} and ${last}.`;
}
