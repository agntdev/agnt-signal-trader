import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { loadState } from "../trading/data.js";

registerMainMenuItem({ label: "Open trades", data: "trades:open", order: 30 });
const composer = new Composer<Ctx>();
const back = inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);

composer.callbackQuery("trades:open", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = await loadState(ctx);
  const open = state.trades.filter((trade) => trade.status === "open" || trade.status === "pending_connection");
  if (open.length === 0) {
    await ctx.editMessageText("No open trades yet — approved signals will appear here.", { reply_markup: back });
    return;
  }
  const lines = open.map((trade) => {
    const protection = `SL ${trade.sl ?? "not set"} · TP ${trade.tp ?? "not set"}`;
    const status = trade.status === "open" ? "open" : "waiting for connection";
    return `${trade.symbol} ${trade.side.toUpperCase()} · ${trade.lots} lots\n${protection} · ${status}`;
  });
  await ctx.editMessageText(`Open trades\n\n${lines.join("\n\n")}`, { reply_markup: back });
});

export default composer;
