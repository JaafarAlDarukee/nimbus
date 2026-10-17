import Link from "next/link";
import { signOut } from "@/app/(app)/profile/actions";
import { Brand, StarField } from "@/components/brand";
import { PRICE, TRIAL_CVS, TRIAL_JOBS, type Access } from "@/lib/access";

const WHAT_YOU_GET = [
  "Every job, placement and grad scheme that fits your degree",
  "Instant Telegram alerts the moment they open",
  "Unlimited CV checks for every job you apply to",
  "Your tracker, calendar and deadline reminders",
  "The private Nimbus Alerts channel",
];

type Props = {
  access: Access;
  justPaid: boolean;
  /** "1 day 4 hours" for trial users */
  left: string;
  /** The Stripe link with who is paying, or null before the owner has set it */
  link: string | null;
  /** The private channel's invite link (only paid users can read it) */
  invite: string;
  home: string;
};

/** /pay: pay once (Stripe), or see that you're in. */
export function PayView({ access, justPaid, left, link, invite, home }: Props) {
  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-bg px-5 py-10 text-tx">
      <StarField count={50} seed={9} />
      <div className="relative flex w-full max-w-[560px] flex-col gap-7">
        <Brand />

        {access === "paid" ? (
          <section className="animate-fade-up flex flex-col gap-5 rounded-3xl border border-line bg-s1 p-7 sm:p-9">
            <h1 className="m-0 font-serif text-[44px] font-normal leading-none tracking-[-0.03em]">
              You&apos;re in, <span className="text-t-sky">for life</span> 🎉
            </h1>
            <p className="m-0 text-[17px] leading-normal text-tx2">Thank you for supporting Nimbus. Everything is unlocked: every job, every alert, unlimited CVs.</p>
            {invite && (
              <a href={invite} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center justify-center rounded-2xl bg-[#2AABEE] px-5 py-3 text-center text-[17px] font-semibold !text-white">
                Join the private Nimbus Alerts channel ↗
              </a>
            )}
            <Link href={home} className="flex h-14 items-center justify-center rounded-2xl bg-[#8FC7FF] text-[17px] font-semibold !text-[#06111D]">
              Go to Nimbus →
            </Link>
          </section>
        ) : (
          <section className="animate-fade-up flex flex-col gap-6 rounded-3xl border border-line bg-s1 p-7 sm:p-9">
            {justPaid ? (
              <>
                <h1 className="m-0 font-serif text-[40px] font-normal leading-none tracking-[-0.03em]">Payment received, unlocking…</h1>
                <p className="m-0 text-[17px] leading-normal text-tx2">This usually takes a few seconds. Refresh this page in a moment.</p>
                <Link href="/pay?paid=1" className="flex h-14 items-center justify-center rounded-2xl bg-[#8FC7FF] text-[17px] font-semibold !text-[#06111D]">
                  Refresh
                </Link>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  <h1 className="m-0 font-serif text-[44px] font-normal leading-none tracking-[-0.03em]">
                    {access === "trial" ? (
                      <>
                        Unlock <span className="text-t-sky">everything</span>
                      </>
                    ) : (
                      <>
                        Your free trial <span className="text-t-sky">has ended</span>
                      </>
                    )}
                  </h1>
                  <p className="m-0 text-[17px] leading-normal text-tx2">
                    {access === "trial"
                      ? `You're on the free trial (${left} left, ${TRIAL_JOBS} jobs and ${TRIAL_CVS} CVs).`
                      : "Nimbus was built by a student, for students. Pay once and it's yours for good."}
                  </p>
                </div>

                <div className="flex flex-col gap-4 rounded-2xl border-2 border-[#8FC7FF] bg-[rgba(143,199,255,.08)] p-6">
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-[64px] leading-none">{PRICE}</span>
                    <span className="text-[17px] text-tx2">once · lifetime access</span>
                  </div>
                  <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[16px] leading-snug">
                    {WHAT_YOU_GET.map((w) => (
                      <li key={w} className="flex gap-2.5">
                        <span className="text-t-mint">✓</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {link ? (
                  <a href={link} className="flex h-16 items-center justify-center rounded-2xl bg-[#8FC7FF] text-[20px] font-semibold !text-[#06111D] transition-transform active:scale-[.98]">
                    Pay {PRICE} and unlock
                  </a>
                ) : (
                  <span className="rounded-2xl border border-line2 p-4 text-center text-[16px] text-tx2">Payments open very soon. Check back in a little while.</span>
                )}
                <span className="text-center text-[13px] leading-normal text-tx3">
                  Secure payment by Stripe; your statement says NIMBUS. No subscription, nothing else to pay. Paid already? It unlocks within a minute.
                </span>
                {access === "trial" && (
                  <Link href="/" className="text-center text-[14px] text-t-sky">
                    Not now, back to my free trial
                  </Link>
                )}
              </>
            )}
          </section>
        )}

        <form action={signOut} className="text-center">
          <button type="submit" className="cursor-pointer text-[13px] text-tx3 hover:text-tx">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
