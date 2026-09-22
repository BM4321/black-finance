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
    .map((section) => `${section.source.count} ${label(section.source)}`);

  if (parts.length === 0) {
    return "No matching data was found for this question.";
  }

  if (parts.length === 1) {
    return `Based on ${parts[0]}.`;
  }

  const last = parts.pop();
  return `Based on ${parts.join(", ")} and ${last}.`;
}

/**
 * Singularise a count's label when there is exactly one.
 *
 * Labels are stored in plural form ("goals", "budget items"). A simple trailing
 * "s" trim is enough for the labels used here and avoids a dependency or a
 * lookup table that would drift. A single item already ending in "s" (there are
 * none today) would be left unchanged rather than mangled.
 */
function label(source: { label: string; count: number }): string {
  if (source.count !== 1) return source.label;
  return source.label.endsWith("s")
    ? source.label.slice(0, -1)
    : source.label;
}

