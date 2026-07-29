import type { SignalRecord, TradingState } from "./data.js";
import { formatLots, now } from "./data.js";

const number = "([0-9]+(?:\\.[0-9]+)?)";
const read = (pattern: RegExp, text: string): number | undefined => {
  const value = pattern.exec(text)?.[1];
  return value === undefined ? undefined : Number(value);
};

export function parseSignal(text: string, channelUsername: string, state: TradingState): SignalRecord | undefined {
  const reserved = new Set(["BUY", "SELL", "MARKET", "LIMIT", "ENTRY", "AT", "SL", "TP", "STOP", "LOSS", "TAKE", "PROFIT", "LOT", "LOTS", "SIZE"]);
  const symbol = [...text.toUpperCase().matchAll(/\b([A-Z]{3,10}(?:\/[A-Z]{3,10})?)\b/g)]
    .map((match) => match[1])
    .find((candidate) => !reserved.has(candidate));
  const side = /\b(BUY|SELL)\b/i.exec(text)?.[1]?.toLowerCase() as "buy" | "sell" | undefined;
  if (!symbol || !side) return undefined;
  const market = /\bMARKET\b/i.test(text);
  const entryPrice = read(new RegExp(`(?:ENTRY|AT|LIMIT)\\s*[:@]?\\s*${number}`, "i"), text);
  if (!market && entryPrice === undefined) return undefined;
  const lots = read(new RegExp(`(?:LOT|LOTS|SIZE)\\s*[:@]?\\s*${number}`, "i"), text);
  return {
    rawText: text,
    symbol,
    side,
    entryPrice,
    stopLoss: read(new RegExp(`(?:SL|STOP\\s*LOSS)\\s*[:@]?\\s*${number}`, "i"), text),
    takeProfit: read(new RegExp(`(?:TP|TAKE\\s*PROFIT)\\s*[:@]?\\s*${number}`, "i"), text),
    lots: formatLots(state, lots),
    timestamp: now(),
    channelUsername,
  };
}
