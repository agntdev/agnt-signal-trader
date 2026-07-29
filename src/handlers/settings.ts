import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { flow, loadState, saveState, setFlow } from "../trading/data.js";

registerMainMenuItem({ label: "Risk settings", data: "settings:risk", order: 50 });
const composer = new Composer<Ctx>();
const back = inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);

composer.callbackQuery("settings:risk", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = await loadState(ctx);
  setFlow(ctx, { kind: "risk" });
  await ctx.reply(`Your default risk is ${state.riskPercent}%. Send a new risk from 0.1 to 10.`, { reply_markup: inlineKeyboard([[inlineButton("Cancel", "flow:cancel")]]) });
});

composer.on("message:text", async (ctx, next) => {
  if (flow(ctx)?.kind !== "risk") return next();
  const risk = Number(ctx.message.text.trim());
  if (!Number.isFinite(risk) || risk < 0.1 || risk > 10) {
    await ctx.reply("Send a risk percentage from 0.1 to 10.");
    return;
  }
  const state = await loadState(ctx);
  state.riskPercent = risk;
  state.ownerChatId = ctx.chat?.id;
  await saveState(ctx, state);
  setFlow(ctx, undefined);
  await ctx.reply(`Your default risk is now ${risk}%.`, { reply_markup: back });
});

export default composer;
