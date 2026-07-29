import { describe, expect, it } from "vitest";
import { blankState, score } from "../src/trading/data";
import { parseSignal } from "../src/trading/signals";

describe("trading signal parsing", () => {
  it("parses a complete market signal and derives lots from configured risk", () => {
    const state = blankState();
    state.availableBalance = 10_000;
    const signal = parseSignal("BUY EUR/USD MARKET SL 1.0800 TP 1.1000", "signals", state);
    expect(signal).toMatchObject({
      symbol: "EUR/USD",
      side: "buy",
      lots: 0.1,
      stopLoss: 1.08,
      takeProfit: 1.1,
    });
  });

  it("rejects a signal without an entry or market instruction", () => {
    expect(parseSignal("BUY EUR/USD SL 1.0800", "signals", blankState())).toBeUndefined();
  });

  it("ranks channel accuracy alongside the owner priority weight", () => {
    expect(score({ username: "accurate", priorityWeight: 5, accuracyHistory: [true, true] }))
      .toBeGreaterThan(score({ username: "weak", priorityWeight: 5, accuracyHistory: [false, false] }));
  });
});
