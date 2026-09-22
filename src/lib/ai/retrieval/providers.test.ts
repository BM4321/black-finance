import { describe, expect, it, vi } from "vitest";

import {
  debtsProvider,
  goalsProvider,
  investmentsProvider,
} from "@/lib/ai/retrieval/providers";
import type { AiClient } from "@/lib/ai/retrieval/types";

// The providers only pass the client through to the data layer, so a bare
// object is enough here. Mocking the data modules keeps these tests focused on
// the *shape* each provider sends to the model.
const client = {} as AiClient;

const { listGoals, listHoldings, listDebts } = vi.hoisted(() => ({
  listGoals: vi.fn(),
  listHoldings: vi.fn(),
  listDebts: vi.fn(),
}));

vi.mock("@/lib/data/goals", () => ({ listGoals }));
vi.mock("@/lib/data/investments", () => ({ listHoldings }));
vi.mock("@/lib/data/debts", () => ({ listDebts }));

const period = { from: "2026-09-01", to: "2026-09-30", label: "this month" };

describe("goalsProvider", () => {
  it("reports goals with derived progress and omits the user id", async () => {
    listGoals.mockResolvedValue({
      active: [
        {
          id: "g1",
          user_id: "secret",
          name: "Driving lessons",
          target_amount: 300000,
          current_amount: 120000,
          remaining: 180000,
          target_date: "2026-12-31",
          percent_complete: 40,
        },
      ],
      archived: [{ id: "g2" }],
      totalSaved: "120000",
      totalTarget: "300000",
    });

    const section = await goalsProvider.run(client, "", period);
    if (!section) throw new Error("expected a section");

    expect(section.id).toBe("goals");
    expect(section.source).toEqual({ label: "goals", count: 1 });
    const data = section.data as Record<string, unknown>;
    expect(data.totalSaved).toBe("120000");
    expect(data.archivedCount).toBe(1);
    const goals = data.activeGoals as Array<Record<string, unknown>>;
    expect(goals[0]).toMatchObject({
      name: "Driving lessons",
      percentComplete: 40,
      saved: "120000",
      remaining: "180000",
    });
    // The raw user id must never be sent to the model.
    expect(JSON.stringify(section)).not.toContain("secret");
  });
});

describe("investmentsProvider", () => {
  it("reports holdings with cost, value and gain, and flags manual pricing", async () => {
    listHoldings.mockResolvedValue({
      active: [
        {
          id: "i1",
          name: "NMB shares",
          asset_type: "stock",
          quantity: 10,
          cost_basis: 10000,
          market_value: 12000,
          gain: 2000,
          purchase_date: "2026-01-15",
        },
      ],
      archived: [],
      totalValue: "12000",
      totalCost: "10000",
      totalGain: "2000",
    });

    const section = await investmentsProvider.run(client, "", period);
    if (!section) throw new Error("expected a section");

    expect(section.source).toEqual({ label: "holdings", count: 1 });
    const data = section.data as Record<string, unknown>;
    expect(data.totalGain).toBe("2000");
    expect(String(data.note)).toMatch(/manually/i);
    const holdings = data.holdings as Array<Record<string, unknown>>;
    expect(holdings[0]).toMatchObject({
      name: "NMB shares",
      marketValue: "12000",
      gain: "2000",
    });
  });
});

describe("debtsProvider", () => {
  it("reports open debts by direction and the net position", async () => {
    listDebts.mockResolvedValue({
      owedByMe: [
        {
          counterparty: "Bank",
          principal: 2000,
          remaining_amount: 1500,
          due_date: "2026-06-15",
        },
      ],
      owedToMe: [
        {
          counterparty: "John",
          principal: 5000,
          remaining_amount: 5000,
          due_date: null,
        },
      ],
      closed: [{ id: "d3" }],
      totalOwedByMe: "1500",
      totalOwedToMe: "5000",
      net: "3500",
    });

    const section = await debtsProvider.run(client, "", period);
    if (!section) throw new Error("expected a section");

    expect(section.source).toEqual({ label: "debts", count: 2 });
    const data = section.data as Record<string, unknown>;
    expect(data.totalOwedByMe).toBe("1500");
    expect(data.totalOwedToMe).toBe("5000");
    expect(data.net).toBe("3500");
    expect(data.closedCount).toBe(1);
    const owedToMe = data.owedToMe as Array<Record<string, unknown>>;
    expect(owedToMe[0]).toMatchObject({
      counterparty: "John",
      outstanding: "5000",
    });
  });
});
