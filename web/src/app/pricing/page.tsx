import type { Metadata } from "next";
import Link from "next/link";
import { Brand, StarField } from "@/components/brand";
import { PAID_FEATURES, PRICE, TRIAL_FEATURES } from "@/lib/access";

export const metadata: Metadata = { title: "Pricing · Nimbus", description: "2 days free, then £5 once for lifetime access." };

/** How soon you hear about a role, by where you look. Nimbus's figure is measured (checks every 15
 *  minutes); job sites' emails have been seen sending placements a month after they opened. */
const SPEED = [
  { where: "The employer's own careers site", when: "The moment it opens", width: 2, tone: "var(--tx3)" },
  { where: "Nimbus", when: "Usually within 30 minutes", width: 8, tone: "#8FC7FF", badge: "Fastest" },
  { where: "Job sites and their emails", when: "Hours to weeks later", width: 78, tone: "#F08A8A" },
];

function Check({ dim }: { dim?: boolean }) {
  return (
    <span className={`mt-0.5 grid size-5 flex-none place-items-center rounded-full ${dim ? "bg-s2 text-tx3" : "bg-[rgba(147,224,192,.2)] text-t-mint"}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
        <path d="m2 5 2 2 4-4" />
      </svg>
    </span>
  );
}

/** Public: what Nimbus costs and what you get (owner, 18 Oct: "£5 and get X, Y, Z, like this example"). */
export default function PricingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-bg px-5 pb-20 pt-8 text-tx">
      <StarField count={60} seed={13} />
      <div className="relative flex w-full max-w-[980px] flex-col gap-12">
        <header className="flex items-center justify-between">
          <Link href="/login"><Brand /></Link>
          <Link href="/login" className="flex h-10 items-center rounded-full bg-[#8FC7FF] px-4 text-[14px] font-semibold !text-[#06111D]">
            Start free
          </Link>
        </header>

        <section className="animate-fade-up flex flex-col items-center gap-4 text-center">
          <h1 className="m-0 font-serif text-[48px] font-normal leading-[1.02] tracking-[-0.03em] sm:text-[64px]">
            One price. <span className="italic text-t-sky">Every opening.</span>
          </h1>
          <p className="m-0 max-w-[560px] text-[17px] leading-normal text-tx2">
            Try Nimbus free for 2 days. If it helps, pay {PRICE} once and keep it for good. No subscription.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-[1fr_1.35fr]">
          <div className="animate-fade-up flex flex-col gap-5 rounded-3xl border border-line bg-s1 p-7">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold uppercase tracking-[.08em] text-tx3">Free trial</span>
              <span className="font-serif text-[48px] leading-none">£0</span>
              <span className="text-[15px] text-tx2">for 2 days, no card needed</span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px] leading-snug">
              {TRIAL_FEATURES.map((f) => (
                <li key={f} className="flex gap-2.5"><Check dim /><span className="text-tx2">{f}</span></li>
              ))}
            </ul>
            <Link href="/login" className="mt-auto flex h-12 items-center justify-center rounded-2xl border border-line2 text-[16px] font-semibold !text-tx">
              Start your free trial
            </Link>
          </div>

          <div className="animate-fade-up flex flex-col gap-5 rounded-3xl border-2 border-[#8FC7FF] bg-[rgba(143,199,255,.07)] p-7" style={{ animationDelay: "80ms" }}>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold uppercase tracking-[.08em] text-t-sky">Nimbus</span>
              <span className="flex items-baseline gap-2">
                <span className="font-serif text-[64px] leading-none">{PRICE}</span>
                <span className="text-[16px] text-tx2">once · lifetime access</span>
              </span>
              <span className="text-[15px] text-tx2">Everything in the trial, without the limits, plus:</span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px] leading-snug">
              {PAID_FEATURES.map((f) => (
                <li key={f} className="flex gap-2.5"><Check /><span>{f}</span></li>
              ))}
            </ul>
            <Link href="/login" className="mt-auto flex h-14 items-center justify-center rounded-2xl bg-[#8FC7FF] text-[18px] font-semibold !text-[#06111D]">
              Start free, unlock for {PRICE} when you&apos;re ready
            </Link>
          </div>
        </section>

        <section className="animate-fade-up flex flex-col gap-6 rounded-3xl border border-line bg-s1 p-7" style={{ animationDelay: "140ms" }}>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold uppercase tracking-[.08em] text-tx3">When do you hear about a new role?</span>
            <h2 className="m-0 font-serif text-[34px] font-normal leading-tight">Job sites are slow. Nimbus goes to the source.</h2>
            <p className="m-0 text-[15px] leading-normal text-tx2">
              Job sites copy roles from employers and email them out later, after many people have applied. Nimbus reads employers&apos; own
              careers sites every 15 minutes.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {SPEED.map((s) => (
              <div key={s.where} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[230px_minmax(0,1fr)_190px] sm:gap-4">
                <span className="flex items-center gap-2 text-[15px] font-medium">
                  {s.where}
                  {s.badge && <span className="rounded-full bg-b-sky px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[.06em] text-t-sky">{s.badge}</span>}
                </span>
                <span className="h-2.5 rounded-full bg-s2">
                  <span className="block h-full rounded-full" style={{ width: `${s.width}%`, background: s.tone }} />
                </span>
                <span className="text-[14px] font-semibold sm:text-right" style={{ color: s.tone }}>{s.when}</span>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] text-tx3">
          <span>Nimbus never applies or messages employers for you.</span>
          <Link href="/terms" className="!text-tx3 hover:!text-tx">Terms and refunds</Link>
          <Link href="/privacy" className="!text-tx3 hover:!text-tx">Privacy</Link>
        </footer>
      </div>
    </main>
  );
}
