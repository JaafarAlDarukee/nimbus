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
  "🔭 When a role that fits <b>your</b> radar opens (your degree, types, industries and places), I message you, usually within 30 minutes of it appearing on the employer's site.",
  "",
  "Under each alert:",
  "• <b>Open and apply</b> goes straight to the employer's page",
  "• <b>Save</b> puts it in your tracker",
  "• <b>Applied</b> marks it applied, and I remind you to follow up in 14 days",
  "• <b>Not for me</b> hides it everywhere",
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
async function onButton(cb: any) {
  const chatId: number | undefined = cb.message?.chat?.id;
  const [action, opportunityId] = String(cb.data ?? "").split(":");
  const answer = (text: string) => tg("answerCallbackQuery", { callback_query_id: cb.id, text });
  if (!chatId || !UUID.test(opportunityId ?? "") || !["s", "a", "n"].includes(action)) return answer("That button has expired.");

  const userId = await userForChat(chatId);
  if (!userId) return answer("Connect your Nimbus account first: Profile → Telegram → Connect.");

  const { data: role } = await db.from("opportunities").select("id,title,company_name,company_id").eq("id", opportunityId).maybeSingle();
  if (!role) return answer("That role has closed.");

  let label = "";
  if (action === "n") {
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

  // Show what was pressed on the message itself
  // deno-lint-ignore no-explicit-any
  const keyboard = (cb.message?.reply_markup?.inline_keyboard ?? []).map((row: any[]) =>
    row.map((button) => (button.callback_data === cb.data ? { ...button, text: label } : button)),
  );
  await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message.message_id, reply_markup: { inline_keyboard: keyboard } });
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (!TOKEN || req.headers.get("x-telegram-bot-api-secret-token") !== (await webhookSecret())) {
    return new Response("Not allowed", { status: 401 });
  }
  const update = await req.json().catch(() => ({}));
  try {
    if (update.message) await onMessage(update.message);
    else if (update.callback_query) await onButton(update.callback_query);
  } catch (e) {
    console.error("update failed:", e instanceof Error ? e.name : "unknown");
  }
  // Always 200, or Telegram keeps retrying the same update
  return new Response("ok");
});
