import type { Ctx } from "../bot.js";

export type AccountType = "demo" | "live";
export type TradeStatus = "pending_connection" | "open" | "closed" | "rejected";

export interface ChannelRecord {
  username: string;
  priorityWeight: number;
  accuracyHistory: boolean[];
  lastScanned?: number;
}

export interface SignalRecord {
  rawText: string;
  symbol: string;
  side: "buy" | "sell";
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  lots: number;
  timestamp: number;
  channelUsername: string;
}

export interface TradeRecord {
  symbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit";
  lots: number;
  entryPrice?: number;
  sl?: number;
  tp?: number;
  accountType: AccountType;
  status: TradeStatus;
  fillPrice?: number;
  channelUsername: string;
  timestamp: number;
}

export interface PerformanceRecord {
  channelUsername: string;
  symbol: string;
  outcome: "win" | "loss";
  timestamp: number;
}

export interface TradingState {
  ownerChatId?: number;
  accountType: AccountType;
  availableBalance: number;
  riskPercent: number;
  channels: ChannelRecord[];
  signals: SignalRecord[];
  trades: TradeRecord[];
  performance: PerformanceRecord[];
  pendingConflict?: { first: SignalRecord; second: SignalRecord };
}

interface Vault {
  iv: string;
  ciphertext: string;
}

type TradingSession = { tradingVault?: Vault; flow?: { kind: "channel_username" | "channel_priority" | "risk"; username?: string; expiresAt: number } };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let clock: () => number = () => Date.now();
/** Injectable clock seam for schedule and expiry tests. */
export const now = (): number => clock();
export function setClockForTests(next: (() => number) | undefined): void {
  clock = next ?? (() => Date.now());
}

function bytesToBase64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function base64ToBytes(value: string): Uint8Array {
  const text = atob(value);
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

function tokenFor(ctx: Ctx): string {
  const workerToken = (ctx as unknown as { env?: { BOT_TOKEN?: string } }).env?.BOT_TOKEN;
  return workerToken ?? (typeof process === "undefined" ? "" : process.env.BOT_TOKEN ?? "harness-test-token");
}

async function keyFor(ctx: Ctx): Promise<CryptoKey> {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(tokenFor(ctx)));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function blankState(): TradingState {
  return { accountType: "demo", availableBalance: 0, riskPercent: 1, channels: [], signals: [], trades: [], performance: [] };
}

/**
 * Domain records are kept as one encrypted persistent record in the toolkit's
 * session backend. In production that backend is Redis (Node) or the supplied
 * Durable Object (Workers); the harness receives an isolated ephemeral copy.
 */
export async function loadState(ctx: Ctx): Promise<TradingState> {
  const session = ctx.session as TradingSession;
  if (!session.tradingVault) return blankState();
  try {
    const vault = session.tradingVault;
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bufferSource(base64ToBytes(vault.iv)) },
      await keyFor(ctx),
      bufferSource(base64ToBytes(vault.ciphertext)),
    );
    return { ...blankState(), ...(JSON.parse(decoder.decode(plain)) as TradingState) };
  } catch {
    return blankState();
  }
}

export async function saveState(ctx: Ctx, state: TradingState): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bufferSource(iv) },
    await keyFor(ctx),
    encoder.encode(JSON.stringify(state)),
  );
  (ctx.session as TradingSession).tradingVault = { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(cipher)) };
}

export function flow(ctx: Ctx): TradingSession["flow"] {
  const active = (ctx.session as TradingSession).flow;
  if (active && active.expiresAt <= now()) {
    (ctx.session as TradingSession).flow = undefined;
    return undefined;
  }
  return active;
}

export function setFlow(ctx: Ctx, value: Omit<NonNullable<TradingSession["flow"]>, "expiresAt"> | undefined): void {
  (ctx.session as TradingSession).flow = value ? { ...value, expiresAt: now() + 5 * 60 * 1000 } : undefined;
}

export function score(channel: ChannelRecord): number {
  const results = channel.accuracyHistory;
  const accuracy = results.length === 0 ? 0 : results.filter(Boolean).length / results.length;
  return channel.priorityWeight + accuracy * 100;
}

export function formatLots(state: TradingState, explicit?: number): number {
  if (explicit && explicit > 0) return explicit;
  // A balance of zero means no broker balance has been confirmed yet; do not invent one.
  return Number(((state.availableBalance * (state.riskPercent / 100)) / 1000).toFixed(2));
}
