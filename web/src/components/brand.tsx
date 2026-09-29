import { cn } from "@/lib/utils";

const CLOUD = "M7.5 17.5h9a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.6 1.1A3 3 0 0 0 7.5 17.5z";
const SMALL_STAR = "M19.5 2.8l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z";
export const SPARKLE = "M5 0l1.2 3.8L10 5 6.2 6.2 5 10 3.8 6.2 0 5l3.8-1.2z";

/** The Nimbus mark: a single-stroke cloud with a dawn star. */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      style={{ fill: "none", stroke: "var(--t-sky)", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }}
    >
      <path d={CLOUD} />
      <path d={SMALL_STAR} style={{ fill: "#F3C38F", stroke: "none" }} />
    </svg>
  );
}

/** Four-point star, used as sparkle and for the dot of the "i" in the wordmark. */
export function Sparkle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden className={className} style={style}>
      <path d={SPARKLE} />
    </svg>
  );
}

/** "Nimbus" in Newsreader with a small sky star replacing the i-dot. */
export function Wordmark({ size = 23, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("font-serif leading-none", className)}
      style={{ fontSize: size, letterSpacing: "-0.02em" }}
      aria-label="Nimbus"
    >
      <span aria-hidden>
        N
        <span className="relative inline-block">
          ı
          <Sparkle
            className="absolute"
            style={{ left: "50%", top: "0.06em", width: "0.3em", height: "0.3em", marginLeft: "-0.15em", fill: "#8FC7FF" }}
          />
        </span>
        mbus
      </span>
    </span>
  );
}

export function Brand({ size = 23, markSize = 22 }: { size?: number; markSize?: number }) {
  return (
    <span className="inline-flex items-center gap-[9px] text-tx">
      <LogoMark size={markSize} />
      <Wordmark size={size} />
    </span>
  );
}

/** Deterministic star field (same stars on server and client). */
export function StarField({ count = 70, seed = 3, className }: { count?: number; seed?: number; className?: string }) {
  let s = seed;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const stars = Array.from({ length: count }, () => ({
    x: (rnd() * 100).toFixed(1),
    y: (rnd() * 100).toFixed(1),
    r: rnd() > 0.85 ? 2 : 1,
    o: (0.25 + rnd() * 0.6).toFixed(2),
  }));
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {stars.map((star, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.r, height: star.r, opacity: Number(star.o) }}
        />
      ))}
    </div>
  );
}

export const TELEGRAM_BOT_URL = "https://t.me/NimbusRadarBot";

export function TelegramFab({ href = TELEGRAM_BOT_URL }: { href?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open Nimbus in Telegram"
      className="fixed bottom-7 right-7 z-10 flex h-14 items-center gap-2.5 rounded-full bg-telegram pl-4 pr-5 text-sm font-medium !text-white hover:brightness-105"
      style={{ boxShadow: "0 10px 30px -8px rgba(42,171,238,.6)" }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style={{ fill: "#fff" }}>
        <path d="M21.4 3.6 2.9 10.8c-.9.4-.9 1.6.1 1.9l4.6 1.4 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.5 4.6 3.4c.6.4 1.4.1 1.6-.6L22.9 5c.2-.9-.6-1.7-1.5-1.4zM9.8 14.2l8.2-7.4-6.6 8.5-.3 3.3z" />
      </svg>
      Open in Telegram
    </a>
  );
}
