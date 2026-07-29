import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { loadState, score } from "../trading/data.js";

registerMainMenuItem({ label: "View performance", data: "performance:view", order: 20 });
const composer = new Composer<Ctx>();
const back = inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);

composer.callbackQuery("performance:view", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = await loadState(ctx);
  if (state.channels.length === 0) {
    await ctx.editMessageText("No channel performance yet — add a channel to begin tracking.", { reply_markup: back });
    return;
  }
  const lines = state.channels
    .slice()
    .sort((a, b) => score(b) - score(a))
    .map((channel) => {
      const wins = channel.accuracyHistory.filter(Boolean).length;
      const total = channel.accuracyHistory.length;
      const accuracy = total === 0 ? "No closed trades" : `${Math.round((wins / total) * 100)}% accuracy`;
      return `@${channel.username}: ${accuracy} · priority ${Math.round(score(channel))}`;
    });
  const history = state.trades.length === 0 ? "\n\nNo trades have been recorded yet." : `\n\nRecorded trades: ${state.trades.length}`;
  await ctx.editMessageText(`Channel performance\n${lines.join("\n")}${history}`, { reply_markup: back });
});

export default composer;
