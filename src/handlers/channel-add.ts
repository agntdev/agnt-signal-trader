import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { flow, loadState, now, saveState, setFlow } from "../trading/data.js";

registerMainMenuItem({ label: "Add channel", data: "channel:add", order: 10 });
registerMainMenuItem({ label: "Manage channels", data: "channel:manage", order: 11 });

const composer = new Composer<Ctx>();
const back = inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);

composer.callbackQuery("channel:add", async (ctx) => {
  await ctx.answerCallbackQuery();
  setFlow(ctx, { kind: "channel_username" });
  await ctx.reply("Send the channel username, without @.", { reply_markup: inlineKeyboard([[inlineButton("Cancel", "flow:cancel")]]) });
});

composer.on("message:text", async (ctx, next) => {
  const active = flow(ctx);
  if (active?.kind !== "channel_username" && active?.kind !== "channel_priority") return next();
  const text = ctx.message.text.trim();
  if (active.kind === "channel_username") {
    const username = text.replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{5,32}$/.test(username)) {
      await ctx.reply("That username doesn’t look valid. Send the channel username without @.");
      return;
    }
    setFlow(ctx, { kind: "channel_priority", username });
    await ctx.reply("Send its priority weight from 1 to 100.", { reply_markup: inlineKeyboard([[inlineButton("Cancel", "flow:cancel")]]) });
    return;
  }
  const priority = Number(text);
  if (!Number.isFinite(priority) || priority < 1 || priority > 100) {
    await ctx.reply("Send a whole-number priority from 1 to 100.");
    return;
  }
  const state = await loadState(ctx);
  if (state.channels.some((channel) => channel.username === active.username)) {
    setFlow(ctx, undefined);
    await ctx.reply("That channel is already monitored.", { reply_markup: back });
    return;
  }
  state.ownerChatId = ctx.chat?.id;
  state.channels.push({ username: active.username!, priorityWeight: priority, accuracyHistory: [], lastScanned: now() });
  await saveState(ctx, state);
  setFlow(ctx, undefined);
  await ctx.reply(`Monitoring @${active.username}. Its priority weight is ${priority}.`, { reply_markup: back });
});

composer.callbackQuery("channel:manage", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = await loadState(ctx);
  if (state.channels.length === 0) {
    await ctx.editMessageText("No channels are monitored yet — tap Add channel to add one.", { reply_markup: back });
    return;
  }
  const rows = state.channels.map((channel, index) => [inlineButton(`Remove @${channel.username}`, `channel:remove:${index}`)]);
  rows.push([inlineButton("Back to menu", "menu:main")]);
  await ctx.editMessageText("Choose a channel to stop monitoring.", { reply_markup: inlineKeyboard(rows) });
});

composer.callbackQuery(/^channel:remove:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const index = Number(ctx.match[1]);
  const state = await loadState(ctx);
  const channel = state.channels[index];
  if (!channel) {
    await ctx.editMessageText("That channel is no longer in your list.", { reply_markup: back });
    return;
  }
  state.channels.splice(index, 1);
  await saveState(ctx, state);
  await ctx.editMessageText(`Stopped monitoring @${channel.username}.`, { reply_markup: back });
});

export default composer;
