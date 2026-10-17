import { ImageResponse } from "next/og";

/** The Nimbus logo (the Telegram logo's cloud and star, design/telegram/logo-night.html) at any size. */
export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0B0E13" }}>
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="#8FC7FF" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.5 17.5h9a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.6 1.1A3 3 0 0 0 7.5 17.5z" />
          <path d="M19.5 2.8l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" fill="#F3C38F" stroke="none" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
