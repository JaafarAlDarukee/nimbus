"use client";

import { useState } from "react";
import { NEXT_COOKIE } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "verifying" | "error";

export function LoginForm({ linkError, next }: { linkError: boolean; next: string | null }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>(linkError ? "error" : "idle");
  const [message, setMessage] = useState(
    linkError ? "That login link has expired or was already used. Send a new one." : "",
  );

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    // The email's link may open in this browser: it comes back to the role they tapped
    document.cookie = next ? `${NEXT_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=3600; samesite=lax` : `${NEXT_COOKIE}=; path=/; max-age=0`;
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Anyone can sign up: new accounts start a 2-day free trial (see lib/access.ts)
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (!error) {
      setStatus("sent");
    } else if (/signups not allowed|not been approved/i.test(error.message)) {
      setStatus("error");
      setMessage("New sign-ups are paused for a moment. Try again soon.");
    } else if (/rate|seconds|too many/i.test(error.message)) {
      setStatus("error");
      setMessage("Too many login emails just now. Wait a minute and try again.");
    } else {
      setStatus("error");
      setMessage(error.message);
    }
  }

  /** The code in the email: signs in right here, even inside Telegram's or Instagram's browser. */
  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setStatus("verifying");
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    if (error) {
      setStatus("sent");
      setMessage(/expired/i.test(error.message) ? "That code has expired. Use a different email or ask for a new one." : "That code didn't work. Check it and try again.");
      return;
    }
    document.cookie = `${NEXT_COOKIE}=; path=/; max-age=0`;
    window.location.assign(next ?? "/");
  }

  if (status === "sent" || status === "verifying") {
    return (
      <div className="flex flex-col gap-3 rounded-[14px] border border-line2 bg-s1 px-[18px] py-4 text-left">
        <span className="text-sm leading-normal text-tx2">
          We emailed <span className="text-tx">{email}</span> a login link and a code. Tap the link, or type the code here (it works
          for <span className="font-mono">1 hour</span>):
        </span>
        <form onSubmit={verifyCode} className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Code"
            aria-label="Code from the email"
            className="h-12 min-w-0 flex-1 rounded-[10px] border border-line2 bg-bg px-3 font-mono text-[20px] tracking-[.25em] text-tx outline-none focus:border-l-sky"
          />
          <button
            type="submit"
            disabled={code.length < 6 || status === "verifying"}
            className="h-12 shrink-0 rounded-[10px] bg-sky px-5 text-[15px] font-medium text-on-sky disabled:opacity-60"
          >
            {status === "verifying" ? "Checking…" : "Sign in"}
          </button>
        </form>
        {message && <p className="m-0 text-[13px] text-rose">{message}</p>}
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setCode("");
            setMessage("");
          }}
          className="self-start text-sm font-medium text-t-sky"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={sendLink} className="flex gap-2 rounded-[14px] border border-line2 bg-s1 p-1.5">
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@university.ac.uk"
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] text-tx outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="h-11 whitespace-nowrap rounded-[10px] bg-sky px-[18px] text-sm font-medium text-on-sky hover:brightness-105 disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Email me a login link"}
        </button>
      </form>
      {next && status !== "error" && <p className="m-0 text-left text-[13px] text-tx2">Sign in to open the role you tapped.</p>}
      {status === "error" && <p className="m-0 text-left text-[13px] text-rose">{message}</p>}
    </>
  );
}
