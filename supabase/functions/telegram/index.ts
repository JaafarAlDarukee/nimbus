// The Nimbus bot. Telegram calls this for every message and button press (a webhook):
//  - /start <code> links the chat to a Nimbus account (the code comes from Connect on the website)
//  - /help sends the short tutorial, /stop pauses alerts
//  - Save / Applied / Not for me under an alert update the tracker or hide the role
// Telegram proves it's Telegram with a secret header derived from the bot token, so this function
// is deployed without Supabase's JWT check. Logs never include names, chats or messages.

import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = (Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "").trim();
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const DAY = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const TUTORIAL = [
  "<b>How Nimbus works here</b>",
  "",
  "🔭 Every new placement, internship, graduate job, apprenticeship and event in <b>your</b> field and places: one message each, the type on top, usually within 15 to 30 minutes of it appearing on the employer's site.",
  "",
  "Under each alert:",
  "• <b>Open on Nimbus</b> opens the role on the Nimbus website, with the employer's apply link",
  "• <b>Save</b> puts it in your tracker",
  "• <b>Applied</b> marks it applied, and I remind you to follow up in 14 days",
  "• <b>Not for me</b> hides it everywhere",
  "• After <b>Applied</b>: tap <b>Online test</b>, <b>Interview</b>, <b>Offer</b> or <b>Rejected</b> as it goes, and I send tips",
  "",
  "🔔 <b>/watch</b> Rolls-Royce, JLR, Dyson: the companies you want most, checked every 5 minutes, their roles first. <b>/watchlist</b> shows them.",
  "",
  "⏰ Deadlines: I remind you the day before anything you asked to be reminded about, and when a role you saved is closing soon.",
  "",
  "Change what you get in <b>Profile</b> on the Nimbus website. /stop pauses alerts, /help shows this again.",
].join("\n");

let secret: string | null = null;
async function webhookSecret(): Promise<string> {
  if (secret) return secret;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(TOKEN), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("nimbus-telegram-webhook"));
  secret = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return secret;
}

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`Telegram ${method} failed with ${res.status}`);
}

const say = (chatId: number, text: string) => tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });

async function userForChat(chatId: number): Promise<string | null> {
  const { data } = await db
    .from("notification_channels")
    .select("user_id")
    .eq("channel", "telegram")
    .eq("enabled", true)
    .eq("config->>chat_id", String(chatId))
    .limit(1)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

// deno-lint-ignore no-explicit-any
// ---------------------------------------------------------------- watchlist (/watch, /unwatch, /watchlist)
// The same company names as radar/match.py company_key / watched_as: change them together
const COMPANY_SUFFIXES = /\b(ltd|limited|plc|llp|inc|group|uk|gmbh|co|the|and|ireland|services|holdings)\b/g;
const COMPANY_ALIASES: Record<string, string> = {
  jlr: "jaguar land rover", gsk: "glaxosmithkline", "s&n": "smith nephew", snc: "smith nephew", rr: "rolls royce",
  ge: "ge aerospace", bp: "bp", "p&g": "procter gamble",
};
function companyKey(name: string): string {
  const lowered = (name ?? "").toLowerCase().trim();
  return (COMPANY_ALIASES[lowered] ?? lowered).replace(COMPANY_SUFFIXES, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function sameCompany(company: string, entry: string): boolean {
  const a = companyKey(company);
  const b = companyKey(entry);
  return !!a && !!b && (a === b || a.startsWith(`${b} `));
}
const BOT_KINDS = ["placement", "internship", "spring_week", "insight"];
const WATCH_HELP = [
  "🔔 <b>Watch the companies you want most</b>",
  "Send /watch with their names, separated by commas, for example:",
  "/watch Rolls-Royce, JLR, Siemens, Dyson",
  "",
  "Nimbus checks them every 5 minutes and sends their new roles first, with a 🔔. /watchlist shows them and whether Nimbus can see their careers site; /unwatch Name removes one.",
].join("\n");

/** Can Nimbus see this company, and what's open there now? */
async function coverage(entry: string): Promise<string> {
  const first = companyKey(entry).split(" ")[0];
  if (!first) return `❓ <b>${escape(entry)}</b>`;
  const since = new Date(Date.now() - 120 * DAY).toISOString();
  const [{ data: boards }, { data: roles }] = await Promise.all([
    db.from("sources").select("company_name").ilike("company_name", `%${first}%`).limit(300),
    db.from("opportunities").select("company_name,kind,status,country").ilike("company_name", `%${first}%`).gte("first_seen_at", since).limit(2000),
  ]);
  const mine = (roles ?? []).filter((r) => sameCompany(r.company_name ?? "", entry));
  const open = mine.filter((r) => r.status === "open" && BOT_KINDS.includes(r.kind) && ["GB", "IE"].includes(r.country)).length;
  const now = open ? `${open} placement${open === 1 ? "" : "s"} or internship${open === 1 ? "" : "s"} open now` : "nothing open right now";
  if ((boards ?? []).some((b) => sameCompany(b.company_name ?? "", entry))) {
    return `✅ <b>${escape(entry)}</b>: Nimbus reads their careers site every 5 minutes · ${now}`;
  }
  if (mine.length) return `📧 <b>${escape(entry)}</b>: Nimbus only sees them through job-site emails · ${now}`;
  return `❓ <b>${escape(entry)}</b>: Nimbus can't see this company yet. Noted, so their careers site can be added.`;
}

async function onWatch(chatId: number, text: string) {
  const userId = await userForChat(chatId);
  if (!userId) {
    await say(chatId, "Connect your Nimbus account first: on the website, Profile → Telegram → Connect.");
    return;
  }
  const { data: profile } = await db.from("profiles").select("preferences").eq("id", userId).maybeSingle();
  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>;
  const watch = Array.isArray(prefs.watch) ? (prefs.watch as string[]) : [];
  const [rawCommand, ...rest] = text.split(/\s+/);
  const command = rawCommand.replace(/@\w+$/, "");
  const names = rest.join(" ").split(/[,;\n]+/).map((n) => n.trim()).filter((n) => n.length >= 2 && n.length <= 60).slice(0, 40);

  if (command === "/watchlist" || (command === "/watch" && !names.length)) {
    if (!watch.length) {
      await say(chatId, WATCH_HELP);
      return;
    }
    const lines = await Promise.all(watch.map(coverage));
    await say(chatId, `🔔 <b>Your companies (${watch.length})</b>\n${lines.join("\n")}\n\nAdd more: /watch Name, Name · remove one: /unwatch Name`);
    return;
  }
  if (command === "/unwatch") {
    const keep = watch.filter((w) => !names.some((n) => companyKey(n) === companyKey(w)));
    await db.from("profiles").update({ preferences: { ...prefs, watch: keep } }).eq("id", userId);
    await say(chatId, `Done. You're watching ${keep.length} compan${keep.length === 1 ? "y" : "ies"}.`);
    return;
  }
  const added = names.filter((n, i) => !watch.some((w) => companyKey(w) === companyKey(n)) && names.findIndex((m) => companyKey(m) === companyKey(n)) === i);
  if (!added.length) {
    await say(chatId, "You're already watching those. /watchlist shows them all.");
    return;
  }
  const next = [...watch, ...added].slice(0, 60);
  await db.from("profiles").update({ preferences: { ...prefs, watch: next } }).eq("id", userId);
  const lines = await Promise.all(added.map(coverage));
  // Companies Nimbus can't see yet go to Admin → Suggested companies
  const unknown = added.filter((_, i) => lines[i].startsWith("❓"));
  if (unknown.length) await db.from("company_suggestions").insert(unknown.map((name) => ({ user_id: userId, name })));
  await say(chatId, `🔔 <b>Watching ${next.length} compan${next.length === 1 ? "y" : "ies"}</b> (added ${added.length})\n${lines.join("\n")}\n\nThe moment any role opens at these, you get it first, with a 🔔.`);
}

// ---------------------------------------------------------------- stages after Applied, with tips
const STAGES: Record<string, { stage: string; label: string }> = {
  t: { stage: "online_test", label: "📝 Test ✓" },
  i: { stage: "interview", label: "🎤 Interview ✓" },
  o: { stage: "offer", label: "🎉 Offer ✓" },
  r: { stage: "rejected", label: "✖️ Rejected" },
};
function stageTips(action: string, title: string, company: string): string {
  const role = `<b>${escape(title)}</b> at ${escape(company)}`;
  if (action === "t") {
    return [
      `📝 <b>Online test</b> for ${role}`,
      "• Do it within 2 or 3 days: test links often expire.",
      "• First practise one or two numerical and situational judgement tests (your careers service and many employers have free ones).",
      "• Quiet room, calculator, pen and paper. Read every question twice; don't rush the first few.",
      "• When they invite you to interview, tap 🎤 Interview.",
    ].join("\n");
  }
  if (action === "i") {
    return [
      `🎤 <b>Interview</b> for ${role}`,
      "1. Read the advert again and write down the 5 things they ask for most.",
      "2. Prepare 4 stories in STAR form (Situation, Task, Action, Result), each with a number: your best project, teamwork, a problem you solved, something that went wrong and what you learned.",
      "3. Research them: what they make, one recent news story, their values.",
      "4. Have 2 questions ready for them (e.g. what a placement student's first month looks like).",
      "5. Practise out loud once. You can ask Claude for likely questions with your CV and the advert.",
      "Good luck! 🍀",
    ].join("\n");
  }
  if (action === "o") {
    return `🎉 <b>An offer from ${escape(company)}!</b>\nCongratulations. Check the reply deadline; it's fine to ask for a few days to decide or to wait for other interviews.`;
  }
  return `✖️ Sorry about ${role}.\nSend them one short email asking for feedback, then keep going: most people get several no's before a yes.`;
}

async function onMessage(msg: any) {
  if (msg.chat?.type !== "private") return;
  const chatId: number = msg.chat.id;
  const text: string = (msg.text ?? "").trim();
  const start = text.match(/^\/start(?:\s+([A-Za-z0-9_-]{8,64}))?$/);

  if (start?.[1]) {
    const { data: link } = await db.from("telegram_links").select("user_id,created_at,used_at").eq("code", start[1]).maybeSingle();
    if (!link || link.used_at || Date.now() - new Date(link.created_at).getTime() > 7 * DAY) {
      await say(chatId, "That link has expired. On the Nimbus website, go to <b>Profile → Alerts → Telegram</b> and press <b>Connect</b> for a fresh one.");
      return;
    }
    // One chat belongs to one account: unlink it from anyone else first
    await db.from("notification_channels").update({ enabled: false }).eq("channel", "telegram").eq("config->>chat_id", String(chatId));
    const { error } = await db.from("notification_channels").upsert(
      {
        user_id: link.user_id,
        channel: "telegram",
        enabled: true,
        config: { chat_id: chatId, username: msg.from?.username ?? null, first_name: msg.from?.first_name ?? null },
      },
      { onConflict: "user_id,channel" },
    );
    if (error) {
      console.error("linking failed");
      await say(chatId, "Something went wrong linking your account. Try Connect again in a minute.");
      return;
    }
    await db.from("telegram_links").update({ used_at: new Date().toISOString() }).eq("code", start[1]);
    const name = msg.from?.first_name ? `, ${escape(msg.from.first_name)}` : "";
    await say(chatId, `✨ You're connected${name}. Your alerts will arrive here from now on.\n\n${TUTORIAL}`);
    // On the free trial: say when it ends and what it includes
    const { data: profile } = await db.from("profiles").select("is_admin,paid_at,trial_ends_at").eq("id", link.user_id).maybeSingle();
    if (profile && !profile.is_admin && !profile.paid_at && profile.trial_ends_at && new Date(profile.trial_ends_at).getTime() > Date.now()) {
      const ends = new Date(profile.trial_ends_at).toLocaleString("en-GB", {
        timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      });
      await say(chatId, `⏳ <b>You're on the free trial until ${ends}.</b>\nIt includes 5 alerts. Unlock every alert for £5, once (no subscription): ${SITE}/pay`);
    }
    return;
  }

  if (/^\/(watchlist|watch|unwatch)(@\w+)?(\s|$)/.test(text)) {
    await onWatch(chatId, text);
    return;
  }

  if (text.startsWith("/start") || text.startsWith("/help")) {
    const linked = await userForChat(chatId);
    await say(
      chatId,
      linked
        ? TUTORIAL
        : "Hi, I'm the Nimbus bot. To get <b>your own</b> alerts here, open the Nimbus website, go to <b>Profile → Alerts → Telegram</b> and press <b>Connect</b>. It brings you back here and links your account.",
    );
    return;
  }

  if (text.startsWith("/stop")) {
    await db.from("notification_channels").update({ enabled: false }).eq("channel", "telegram").eq("config->>chat_id", String(chatId));
    await say(chatId, "Alerts paused. Connect again from Profile on the website whenever you want them back.");
    return;
  }

  await say(chatId, "I only send alerts. Use the buttons under each one, or /help to see how it works.");
}

// deno-lint-ignore no-explicit-any
const CHANNEL_USES: Record<string, string> = {
  summary: "the morning summary", engineering: "engineering roles", medical: "medical and health roles", business: "business roles",
  computing: "computing roles", science: "science roles", creative: "creative roles", none: "nothing for now",
};

/** "c:<use>:<channel id>": the owner chose what one of their channels gets */
async function onChannelChoice(cb: any) {
  const answer = (text: string) => tg("answerCallbackQuery", { callback_query_id: cb.id, text });
  const [, use, channel] = String(cb.data).split(":");
  const chatId: number | undefined = cb.message?.chat?.id;
  if (!chatId || !(use in CHANNEL_USES) || !/^-?\d+$/.test(channel ?? "")) return answer("That button has expired.");
  const userId = await userForChat(chatId);
  const { data: profile } = userId ? await db.from("profiles").select("is_admin").eq("id", userId).maybeSingle() : { data: null };
  if (!profile?.is_admin) return answer("Only Nimbus's owner can set this.");
  const { data: row } = await db.from("telegram_channels").update({ field: use === "none" ? null : use }).eq("chat_id", channel).select("title").maybeSingle();
  if (!row) return answer("That channel isn't connected any more.");
  await answer("Saved.");
  await tg("editMessageText", {
    chat_id: chatId,
    message_id: cb.message.message_id,
    parse_mode: "HTML",
    text: `✅ <b>${escape(row.title ?? "Your channel")}</b> gets ${CHANNEL_USES[use]}.${use === "summary" ? " The next one arrives just after 7:30 am." : ""}`,
  });
}

async function onButton(cb: any) {
  if (String(cb.data ?? "").startsWith("c:")) return onChannelChoice(cb);
  const chatId: number | undefined = cb.message?.chat?.id;
  const [action, opportunityId] = String(cb.data ?? "").split(":");
  const answer = (text: string) => tg("answerCallbackQuery", { callback_query_id: cb.id, text });
  if (!chatId || !UUID.test(opportunityId ?? "") || !["s", "a", "n", ...Object.keys(STAGES)].includes(action)) return answer("That button has expired.");

  const userId = await userForChat(chatId);
  if (!userId) return answer("Connect your Nimbus account first: Profile → Telegram → Connect.");

  const { data: role } = await db.from("opportunities").select("id,title,company_name,company_id").eq("id", opportunityId).maybeSingle();
  if (!role) return answer("That role has closed.");

  let label = "";
  const stage = STAGES[action];
  if (stage) {
    const now = new Date().toISOString();
    const { data: existing } = await db.from("applications").select("id").eq("user_id", userId).eq("opportunity_id", role.id).maybeSingle();
    if (existing) await db.from("applications").update({ stage: stage.stage, last_update_at: now }).eq("id", existing.id);
    else await db.from("applications").insert({ user_id: userId, opportunity_id: role.id, company_id: role.company_id, title: role.title, company_name: role.company_name, stage: stage.stage, last_update_at: now });
    label = stage.label;
    await answer("Updated in your tracker.");
    await say(chatId, stageTips(action, role.title, role.company_name));
  } else if (action === "n") {
    await db.from("hidden_opportunities").upsert({ user_id: userId, opportunity_id: role.id }, { onConflict: "user_id,opportunity_id" });
    label = "Hidden";
    await answer("Hidden. You won't see it again.");
  } else {
    const now = new Date();
    const { data: existing } = await db.from("applications").select("id,stage,applied_at").eq("user_id", userId).eq("opportunity_id", role.id).maybeSingle();
    const applied = action === "a";
    const fields = applied
      ? { stage: "applied", applied_at: existing?.applied_at ?? now.toISOString(), next_follow_up_at: new Date(now.getTime() + 14 * DAY).toISOString(), last_update_at: now.toISOString() }
      : { stage: "saved", last_update_at: now.toISOString() };
    if (existing) {
      // Saving never moves an application backwards
      if (applied || existing.stage === "saved") await db.from("applications").update(fields).eq("id", existing.id);
    } else {
      await db.from("applications").insert({ user_id: userId, opportunity_id: role.id, company_id: role.company_id, title: role.title, company_name: role.company_name, ...fields });
    }
    label = applied ? "Applied ✓" : "Saved ✓";
    await answer(applied ? "Marked as applied. I'll remind you to follow up in 14 days." : "Saved to your tracker.");
  }

  // Show what was pressed on the message itself; after Applied, the next steps
  // deno-lint-ignore no-explicit-any
  let keyboard = (cb.message?.reply_markup?.inline_keyboard ?? []).map((row: any[]) =>
    row.map((button) => (button.callback_data === cb.data ? { ...button, text: label } : button)),
  );
  if (action === "a") {
    // deno-lint-ignore no-explicit-any
    const links = keyboard.filter((row: any[]) => row.some((button) => button.url));
    keyboard = [
      ...links,
      [{ text: "Applied ✓", callback_data: cb.data }],
      [{ text: "📝 Online test", callback_data: `t:${role.id}` }, { text: "🎤 Interview", callback_data: `i:${role.id}` }],
      [{ text: "🎉 Offer", callback_data: `o:${role.id}` }, { text: "✖️ Rejected", callback_data: `r:${role.id}` }],
    ];
  }
  await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: keyboard } });
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SITE = (Deno.env.get("NIMBUS_SITE_URL") ?? "https://nimbus-pi-three.vercel.app").replace(/\/$/, "");

/** The bot was made an admin of a channel (or removed). Only channels the owner adds count: the
 *  person who added it must be a Nimbus admin connected to this bot. Admin then picks its field. */
async function onChannelMember(update: any) {
  if (update.chat?.type !== "channel") return;
  const userId = await userForChat(update.from?.id);
  if (!userId) return;
  const { data: profile } = await db.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!profile?.is_admin) return;
  const chatId = String(update.chat.id);
  const title = String(update.chat.title ?? "Channel");
  const status = update.new_chat_member?.status;
  if (status === "administrator") {
    await db.from("telegram_channels").upsert({ chat_id: chatId, title }, { onConflict: "chat_id" });
    // Ask what it's for, with buttons (no need for the website)
    const choice = (label: string, use: string) => ({ text: label, callback_data: `c:${use}:${chatId}` });
    await tg("sendMessage", {
      chat_id: update.from.id,
      parse_mode: "HTML",
      text: `✅ Nimbus can post in <b>${escape(title)}</b>. What should it get?`,
      reply_markup: {
        inline_keyboard: [
          [choice("☀️ Morning summary", "summary")],
          [choice("Engineering", "engineering"), choice("Medical & health", "medical")],
          [choice("Business", "business"), choice("Computing", "computing")],
          [choice("Science", "science"), choice("Creative", "creative")],
          [choice("Nothing for now", "none")],
        ],
      },
    });
  } else if (status === "left" || status === "kicked" || status === "member") {
    await db.from("telegram_channels").delete().eq("chat_id", chatId);
    await say(update.from.id, `Nimbus will no longer post in <b>${escape(title)}</b>.`);
  }
}

Deno.serve(async (req) => {
  if (!TOKEN || req.headers.get("x-telegram-bot-api-secret-token") !== (await webhookSecret())) {
    return new Response("Not allowed", { status: 401 });
  }
  const update = await req.json().catch(() => ({}));
  try {
    if (update.message) await onMessage(update.message);
    else if (update.callback_query) await onButton(update.callback_query);
    else if (update.my_chat_member) await onChannelMember(update.my_chat_member);
  } catch (e) {
    console.error("update failed:", e instanceof Error ? e.name : "unknown");
  }
  // Always 200, or Telegram keeps retrying the same update
  return new Response("ok");
});
