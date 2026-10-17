import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { InviteCard } from "@/components/invite-card";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { PRICE, accessState, timeLeft } from "@/lib/access";
import { decide, saveSettings, setPaid } from "./actions";

type Member = {
  id: string;
  email: string;
  first_name: string | null;
  created_at: string;
  onboarded_at: string | null;
  trial_ends_at: string | null;
  paid_at: string | null;
  is_admin: boolean;
  applications: string | null;
  heard_from: string | null;
};

type AccessRequest = { id: string; email: string; status: string; created_at: string; decided_at: string | null };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-[rgba(243,195,143,.12)] text-t-dawn",
  approved: "bg-[rgba(147,224,192,.12)] text-mint",
  declined: "bg-[rgba(244,169,184,.12)] text-rose",
};

export default async function AdminPage(props: PageProps<"/admin">) {
  const params = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user!.id).maybeSingle();
  if (!profile?.is_admin) notFound();

  const { data } = await supabase
    .from("access_requests")
    .select("id,email,status,created_at,decided_at")
    .order("created_at", { ascending: false });
  const requests = (data ?? []) as AccessRequest[];
  // "Missing a company?" on the Companies page: add their careers pages to the radar's seed list
  const { data: suggestionRows } = await supabase.from("company_suggestions").select("name,created_at").order("created_at", { ascending: false }).limit(100);
  const suggestions = Object.values(
    (suggestionRows ?? []).reduce<Record<string, { name: string; times: number; last: string }>>((acc, s) => {
      const key = (s.name as string).trim().toLowerCase();
      acc[key] = acc[key] ? { ...acc[key], times: acc[key].times + 1 } : { name: (s.name as string).trim(), times: 1, last: s.created_at as string };
      return acc;
    }, {}),
  );
  const [{ data: memberRows }, { data: paymentRows }, { data: settingRows }] = await Promise.all([
    supabase.rpc("admin_members"),
    supabase.from("payments").select("amount_pence"),
    supabase.from("app_settings").select("key,value"),
  ]);
  const members = (memberRows ?? []) as Member[];
  const setting = (key: string) => (settingRows ?? []).find((r) => r.key === key)?.value ?? "";
  const earned = (paymentRows ?? []).reduce((sum, p) => sum + (p.amount_pence as number), 0) / 100;
  const paidCount = members.filter((m) => accessState(m) === "paid" && !m.is_admin).length;
  const trialCount = members.filter((m) => accessState(m) === "trial").length;
  const lockedCount = members.filter((m) => accessState(m) === "locked").length;
  const heard = Object.entries(
    members.reduce<Record<string, number>>((acc, m) => (m.heard_from ? { ...acc, [m.heard_from]: (acc[m.heard_from] ?? 0) + 1 } : acc), {}),
  ).sort((a, b) => b[1] - a[1]);
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");
  const notice = typeof params.notice === "string" ? params.notice : null;
  const h = await headers();
  const site = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  const row = (r: AccessRequest, actions: boolean) => (
    <div key={r.id} className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-medium">{r.email}</span>
        <span className="font-mono text-xs text-tx3">asked {timeAgo(r.created_at)}</span>
      </div>
      {actions ? (
        <form action={decide} className="flex gap-2">
          <input type="hidden" name="id" value={r.id} />
          <button name="decision" value="declined" className="h-10 rounded-[10px] border border-line2 px-4 text-sm text-tx2 hover:text-tx">
            Decline
          </button>
          <button name="decision" value="approved" className="h-10 rounded-[10px] bg-sky px-4 text-sm font-medium text-on-sky hover:brightness-105">
            Approve
          </button>
        </form>
      ) : (
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLE[r.status] ?? ""}`}>{r.status}</span>
      )}
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[760px] px-6 py-12">
      <h1 className="m-0 font-serif text-[46px] font-normal leading-none tracking-[-0.03em]">Admin</h1>
      <p className="mt-3 text-[15px] text-tx2">Members, money and links. Anyone can sign up: 2 days free, then {PRICE} once. Only you can see this page.</p>

      {notice && <p className="mt-6 rounded-xl border border-line2 bg-s1 px-4 py-3 text-sm text-tx2">{notice}</p>}

      <InviteCard site={site} />

      <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-[0.08em] text-tx3">Money</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Earned (Stripe)", `£${earned.toFixed(2)}`],
          ["Paid", String(paidCount)],
          ["On free trial", String(trialCount)],
          ["Trial ended", String(lockedCount)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 rounded-2xl border border-line bg-s1 px-4 py-3">
            <span className="font-serif text-[30px] leading-none">{value}</span>
            <span className="text-xs text-tx3">{label}</span>
          </div>
        ))}
      </div>
      {heard.length > 0 && <p className="mt-2 text-xs text-tx3">Heard from: {heard.map(([h, n]) => `${h} ${n}`).join(" · ")}</p>}

      <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-[0.08em] text-tx3">Payment link</h2>
      <form action={saveSettings} className="flex flex-col gap-3 rounded-2xl border border-line bg-s1 p-5">
        <label className="flex flex-col gap-1.5 text-sm text-tx2">
          Stripe payment link ({PRICE} once). People are sent here from the lock screen.
          <input name="stripe_link" defaultValue={setting("stripe_link")} placeholder="https://buy.stripe.com/..." className="h-11 rounded-[10px] border border-line2 bg-bg px-3 font-mono text-[13px] text-tx outline-none focus:border-l-sky" />
        </label>
        <button className="h-10 self-start rounded-[10px] bg-sky px-4 text-sm font-medium text-on-sky hover:brightness-105">Save link</button>
      </form>

      <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-[0.08em] text-tx3">Members ({members.length})</h2>
      <div className="rounded-2xl border border-line bg-s1">
        {members.map((m) => {
          const s = accessState(m);
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3 first:border-t-0">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-medium">{m.first_name || m.email}</span>
                <span className="truncate font-mono text-xs text-tx3">
                  {m.email} · joined {timeAgo(m.created_at)}
                  {m.applications ? ` · plans ${m.applications}` : ""}
                  {m.heard_from ? ` · ${m.heard_from}` : ""}
                </span>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s === "paid" ? STATUS_STYLE.approved : s === "trial" ? STATUS_STYLE.pending : STATUS_STYLE.declined}`}>
                {m.is_admin ? "admin" : s === "paid" ? "paid" : s === "trial" ? `trial · ${timeLeft(m.trial_ends_at)} left` : "trial ended"}
              </span>
              {!m.is_admin && (
                <form action={setPaid}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="paid" value={m.paid_at ? "0" : "1"} />
                  <button className="h-9 rounded-[10px] border border-line2 px-3 text-xs text-tx2 hover:text-tx">{m.paid_at ? "Undo paid" : "Mark paid"}</button>
                </form>
              )}
            </div>
          );
        })}
        {members.length === 0 && <p className="m-0 px-5 py-6 text-sm text-tx3">No members yet.</p>}
      </div>

      <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-[0.08em] text-tx3">Old access requests: waiting ({pending.length})</h2>
      <div className="rounded-2xl border border-line bg-s1">
        {pending.length ? pending.map((r) => row(r, true)) : <p className="m-0 px-5 py-6 text-sm text-tx3">No one waiting right now.</p>}
      </div>

      {decided.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-[0.08em] text-tx3">Decided</h2>
          <div className="rounded-2xl border border-line bg-s1">{decided.map((r) => row(r, false))}</div>
        </>
      )}

      <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-[0.08em] text-tx3">Suggested companies ({suggestions.length})</h2>
      <div className="rounded-2xl border border-line bg-s1">
        {suggestions.length === 0 && <p className="m-0 px-5 py-4 text-sm text-tx3">No suggestions yet.</p>}
        {suggestions.map((s) => (
          <div key={s.name} className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 first:border-t-0">
            <span className="text-[15px] font-medium">{s.name}</span>
            <span className="font-mono text-xs text-tx3">
              {s.times > 1 ? `${s.times} people · ` : ""}
              {timeAgo(s.last)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-tx3">Ask Claude to find their careers pages and add them to the radar.</p>
    </main>
  );
}
