import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import type { SignalRecord, TradingState } from "../trading/data.js";
import { loadState, now, saveState, score } from "../trading/data.js";
import { parseSignal } from "../trading/signals.js";

const composer = new Composer<Ctx>();

function tradeFrom(signal: SignalRecord, state: TradingState) {
  return {
    symbol: signal.symbol,
    side: signal.side,
    orderType: signal.entryPrice === undefined ? "market" as const : "limit" as const,
    lots: signal.lots,
    entryPrice: signal.entryPrice,
    sl: signal.stopLoss,
    tp: signal.takeProfit,
    accountType: state.accountType,
    status: "pending_connection" as const,
    channelUsername: signal.channelUsername,
    timestamp: now(),
  };
}

async function notify(ctx: Ctx, state: TradingState, text: string, replyMarkup?: ReturnType<typeof inlineKeyboard>): Promise<void> {
  if (!state.ownerChatId) return;
  try {
    await ctx.api.sendMessage(state.ownerChatId, text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
  } catch {
    // The owner may have blocked the bot. A failed alert must not lose the signal record.
  }
}

async function queueForExecution(ctx: Ctx, state: TradingState, signal: SignalRecord): Promise<void> {
  state.trades.push(tradeFrom(signal, state));
  await saveState(ctx, state);
  await notify(ctx, state, `${signal.symbol} ${signal.side.toUpperCase()} was recorded for ${state.accountType === "live" ? "Live" : "Demo"}. MetaTrader connection isn’t set up yet, so no order was sent.`);
}

composer.on("channel_post:text", async (ctx) => {
  const username = ctx.channelPost.chat.username?.toLowerCase();
  if (!username) return;
  const state = await loadState(ctx);
  const channel = state.channels.find((item) => item.username === username);
  if (!channel) return;
  channel.lastScanned = now();
  const signal = parseSignal(ctx.channelPost.text, username, state);
  if (!signal) {
    await saveState(ctx, state);
    await notify(ctx, state, `A message from @${username} was skipped because it didn’t include a complete trading signal.`);
    return;
  }
  state.signals.push(signal);
  const competing = state.signals
    .filter((item) => item.symbol === signal.symbol && item.channelUsername !== signal.channelUsername)
    .at(-1);
  if (!competing) {
    await queueForExecution(ctx, state, signal);
    return;
  }
  const otherChannel = state.channels.find((item) => item.username === competing.channelUsername);
  const currentScore = score(channel);
  const otherScore = otherChannel ? score(otherChannel) : -1;
  if (currentScore === otherScore) {
    state.pendingConflict = { first: competing, second: signal };
    await saveState(ctx, state);
    await notify(ctx, state, `Two equally ranked ${signal.symbol} signals conflict. Choose the signal to use.`, inlineKeyboard([
      [inlineButton(`Use @${competing.channelUsername}`, "signal:approve:first")],
      [inlineButton(`Use @${signal.channelUsername}`, "signal:approve:second")],
    ]));
    return;
  }
  await queueForExecution(ctx, state, currentScore > otherScore ? signal : competing);
});

composer.callbackQuery(/^signal:approve:(first|second)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = await loadState(ctx);
  const conflict = state.pendingConflict;
  if (!conflict) {
    await ctx.editMessageText("That approval has already been handled.");
    return;
  }
  const signal = ctx.match[1] === "first" ? conflict.first : conflict.second;
  state.pendingConflict = undefined;
  state.trades.push(tradeFrom(signal, state));
  await saveState(ctx, state);
  await ctx.editMessageText(`${signal.symbol} ${signal.side.toUpperCase()} was approved. MetaTrader connection isn’t set up yet, so no order was sent.`);
});

export default composer;
