import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { setFlow } from "../trading/data.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("flow:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  setFlow(ctx, undefined);
  await ctx.editMessageText("Nothing was changed.", { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) });
});

export default composer;
