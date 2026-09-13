import { describe, expect, it } from "vitest";

import { buildContents, buildContextBlock } from "@/lib/ai/prompt";
import { describeSources } from "@/lib/ai/sources";
import type { FinancialContext } from "@/lib/ai/retrieval/types";

const context: FinancialContext = {
  period: { from: "2026-09-01", to: "2026-09-30", label: "this month" },
  sections: [
    {
      id: "accounts",
      title: "Accounts",
      source: { label: "accounts", count: 2 },
      data: { netWorth: "1045000", currency: "TZS" },
    },
    {
      id: "transactions",
      title: "Transactions",
      source: { label: "transactions", count: 18 },
      data: { totalMatching: 18 },
    },
    {
      id: "budgets",
      title: "Budgets",
      source: { label: "budget items", count: 0 },
      data: { note: "No budget is set for this period." },
    },
  ],
};

describe("describeSources", () => {
  it("lists non-zero sources with counts", () => {
    expect(describeSources(context)).toBe(
      "Based on 2 accounts and 18 transactions.",
    );
  });

  it("uses a comma list with 'and' before the final source", () => {
    const three = {
      ...context,
      sections: [
        { ...context.sections[0] },
        { ...context.sections[1] },
        {
          id: "budgets",
          title: "Budgets",
          source: { label: "budget items", count: 4 },
          data: {},
        },
      ],
    };
    expect(describeSources(three)).toBe(
      "Based on 2 accounts, 18 transactions and 4 budget items.",
    );
  });

  it("omits zero-count sources", () => {
    const onlyBudget = {
      ...context,
      sections: [context.sections[2]],
    };
    expect(describeSources(onlyBudget)).toBe(
      "No matching data was found for this question.",
    );
  });
});

describe("buildContextBlock", () => {
  it("includes the period and JSON sections", () => {
    const block = buildContextBlock(context);
    expect(block).toContain("this month");
    expect(block).toContain("2026-09-01 to 2026-09-30");
    expect(block).toContain('"netWorth": "1045000"');
    expect(block).toContain("--- Accounts ---");
  });

  it("states when nothing was retrieved", () => {
    const empty = buildContextBlock({ ...context, sections: [] });
    expect(empty).toContain("No financial data was available");
  });
});

describe("buildContents", () => {
  it("maps assistant to the 'model' role and attaches context to the question", () => {
    const contents = buildContents(
      [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
      context,
      "how much did I spend?",
    );

    expect(contents[0]).toEqual({ role: "user", parts: [{ text: "hi" }] });
    expect(contents[1]).toEqual({ role: "model", parts: [{ text: "hello" }] });
    const last = contents.at(-1);
    expect(last?.role).toBe("user");
    expect(last?.parts[0].text).toContain("FINANCIAL CONTEXT");
    expect(last?.parts[0].text).toContain("QUESTION: how much did I spend?");
  });

  it("caps history to the most recent 8 turns", () => {
    const longHistory = Array.from({ length: 20 }, (_, index) => ({
      role: "user" as const,
      content: `message ${index}`,
    }));
    const contents = buildContents(longHistory, context, "final");
    // 8 history turns + 1 new question
    expect(contents).toHaveLength(9);
    expect(contents[0].parts[0].text).toBe("message 12");
  });
});
