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
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");
  const now = Date.now();
  const notice = typeof params.notice === "string" ? params.notice : null;

  const row = (r: AccessRequest, actions: boolean) => (
    <div key={r.id} className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-medium">{r.email}</span>
        <span className="font-mono text-xs text-tx3">asked {timeAgo(r.created_at, now)}</span>
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
    </main>
  );
}
