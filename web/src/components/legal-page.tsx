import Link from "next/link";
import { Brand, StarField } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";

/** The contact email set on Admin (readable without signing in). */
export async function contactEmail(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "support_email").maybeSingle();
  return (data?.value as string | null)?.trim() ?? "";
}

export function Contact({ email }: { email: string }) {
  return email ? (
    <a href={`mailto:${email}`} className="text-t-sky">
      {email}
    </a>
  ) : (
    <span>our contact email (it appears here very soon)</span>
  );
}

/** Privacy and Terms: plain English, one column, readable on a phone. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-bg px-5 py-10 text-tx">
      <StarField count={40} seed={11} />
      <article className="relative flex w-full max-w-[680px] flex-col gap-6 text-[16px] leading-[1.65] text-tx2 [&_h2]:m-0 [&_h2]:mt-4 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:text-tx [&_li]:mt-1.5 [&_p]:m-0 [&_strong]:text-tx [&_ul]:m-0 [&_ul]:pl-5">
        <Link href="/login" className="self-start">
          <Brand />
        </Link>
        <header className="flex flex-col gap-2">
          <h1 className="m-0 font-serif text-[44px] font-normal leading-none tracking-[-0.03em] text-tx">{title}</h1>
          <span className="text-[13px] text-tx3">Last updated {updated}</span>
        </header>
        {children}
        <footer className="mt-6 flex gap-4 border-t border-line pt-5 text-[13px] text-tx3">
          <Link href="/privacy" className="!text-tx3 hover:!text-tx">Privacy</Link>
          <Link href="/terms" className="!text-tx3 hover:!text-tx">Terms</Link>
          <Link href="/login" className="!text-tx3 hover:!text-tx">Nimbus</Link>
        </footer>
      </article>
    </main>
  );
}
