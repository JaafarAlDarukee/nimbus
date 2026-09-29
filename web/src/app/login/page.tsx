import { Brand, Sparkle, StarField, TelegramFab } from "@/components/brand";
import { LoginForm } from "./login-form";

const STATS = [
  { value: "2,900+", label: "employers watched" },
  { value: "30 min", label: "between checks" },
  { value: "under 3 h", label: "from posted to your phone" },
];

export default async function LandingPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;

  return (
    <div className="relative flex min-h-screen flex-col items-center" style={{ background: "var(--glow), var(--bg)" }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <StarField count={70} seed={3} />
        <Sparkle className="absolute size-[13px]" style={{ left: "16%", top: 150, fill: "#F3C38F" }} />
        <Sparkle className="absolute size-[9px]" style={{ right: "19%", top: 230, fill: "#C3B5FF" }} />
      </div>

      <header className="relative flex h-[72px] w-full max-w-[1200px] items-center justify-between px-8">
        <Brand />
        <a
          href="#signin"
          className="flex h-9 items-center rounded-full border border-line2 px-3.5 text-[13px] !text-tx hover:border-l-sky"
        >
          Sign in
        </a>
      </header>

      <main className="relative flex w-full max-w-[760px] flex-1 flex-col items-center gap-7 px-6 pb-16 pt-[clamp(56px,12vh,120px)] text-center">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-tx2">Private job radar · UK engineering</span>
        <h1
          className="m-0 font-serif font-normal leading-none"
          style={{ fontSize: "clamp(48px, 9vw, 84px)", letterSpacing: "-0.035em", textWrap: "balance" }}
        >
          Opportunities,
          <br />
          <span className="text-t-sky">the moment they form.</span>
        </h1>
        <p className="m-0 max-w-[520px] text-[17px] leading-[1.55] text-tx2" style={{ textWrap: "pretty" }}>
          We watch employers&apos; own careers pages and message you on Telegram when a placement, internship or
          graduate role opens in your field. You apply first.
        </p>

        <div id="signin" className="flex w-full max-w-[460px] flex-col gap-3 pt-2">
          <LoginForm linkError={searchParams.error === "link"} />
          <span className="text-[13px] text-tx3">Invite only. No invite yet? Ask your course rep or engineering society.</span>
        </div>

        <div className="mt-[72px] grid w-full grid-cols-3 border-t border-line">
          {STATS.map((stat, i) => (
            <div key={stat.label} className={`flex flex-col gap-1.5 px-3 pt-6 ${i ? "border-l border-line" : ""}`}>
              <span className="font-serif leading-none" style={{ fontSize: "clamp(28px, 5vw, 40px)", letterSpacing: "-0.03em" }}>
                {stat.value}
              </span>
              <span className="text-[13px] text-tx3">{stat.label}</span>
            </div>
          ))}
        </div>
      </main>

      <TelegramFab />
      <footer className="relative p-6 text-[13px] text-tx3">Nimbus never applies or messages employers for you.</footer>
    </div>
  );
}
