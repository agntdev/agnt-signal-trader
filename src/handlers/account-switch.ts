import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { confirmKeyboard, inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { loadState, now, saveState } from "../trading/data.js";

registerMainMenuItem({ label: "Switch account", data: "account:switch", order: 40 });
const composer = new Composer<Ctx>();
const back = inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);

composer.callbackQuery("account:switch", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = await loadState(ctx);
  if (state.accountType === "live") {
    await ctx.editMessageText("You’re trading on Live. Switch back to Demo?", { reply_markup: confirmKeyboard("account:demo", { yes: "Use Demo", no: "Keep Live" }) });
    return;
  }
  await ctx.editMessageText("Switch to Live trading? Orders can use real funds.", { reply_markup: confirmKeyboard("account:live", { yes: "Switch to Live", no: "Keep Demo" }) });
});

composer.callbackQuery(/^account:(live|demo):(yes|no)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, target, answer] = ctx.match;
  if (answer === "no") {
    await ctx.editMessageText("Your account setting was not changed.", { reply_markup: back });
    return;
  }
  const state = await loadState(ctx);
  state.accountType = target as "demo" | "live";
  state.ownerChatId = ctx.chat?.id;
  await saveState(ctx, state);
  await ctx.editMessageText(`Trading is set to ${target === "live" ? "Live" : "Demo"}.`, { reply_markup: back });
});

export default composer;
