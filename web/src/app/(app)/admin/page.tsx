import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { decide } from "./actions";

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
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");
  const notice = typeof params.notice === "string" ? params.notice : null;

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
      <h1 className="m-0 font-serif text-[46px] font-normal leading-none tracking-[-0.03em]">Access requests</h1>
      <p className="mt-3 text-[15px] text-tx2">Approve someone and they get a sign-in email straight away. Only you can see this page.</p>

      {notice && <p className="mt-6 rounded-xl border border-line2 bg-s1 px-4 py-3 text-sm text-tx2">{notice}</p>}

      <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-[0.08em] text-tx3">Waiting ({pending.length})</h2>
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
