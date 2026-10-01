"use client";

import { useState } from "react";

/** Admin: a ready-to-send invite for friends, and what happens after they tap the link. */
export function InviteCard({ site }: { site: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Made something for us 🫵 Nimbus finds engineering and science placements, internships and grad jobs the moment they open, and pings you on Telegram. It also checks your CV for each job.

1. Open ${site}
2. Type your email, tap "Email me a login link", then "Request access"
3. I approve you, you get an email from "Children of Khan" (check spam), tap it
4. Pick your degree and what you want (2 mins), then connect Telegram

On your phone: open the link, then browser menu → "Add to Home screen".`;
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-s1 px-5 py-4">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-tx3">Invite a friend</span>
      <pre className="m-0 whitespace-pre-wrap rounded-xl border border-line2 bg-bg p-3 font-sans text-[13px] leading-[1.5] text-tx2">{message}</pre>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(message).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="h-10 cursor-pointer rounded-[10px] bg-sky px-4 text-sm font-medium text-on-sky hover:brightness-105"
        >
          {copied ? "Copied: paste it in your group chat" : "Copy the invite"}
        </button>
        <span className="text-xs text-tx3">When they ask, they appear under Waiting below and you get a Telegram ping. Approve them here.</span>
      </div>
    </div>
  );
}
