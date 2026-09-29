"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(linkError ? "error" : "idle");
  const [message, setMessage] = useState(
    linkError ? "That login link has expired or was already used. Send a new one." : "",
  );

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Invite-only: the login form never creates accounts
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (!error) {
      setStatus("sent");
      return;
    }
    setStatus("error");
    if (/signups not allowed|not found|user/i.test(error.message)) {
      setMessage("This email hasn't been invited to Nimbus yet.");
    } else if (/rate|seconds/i.test(error.message)) {
      setMessage("Too many login emails just now. Wait a minute and try again.");
    } else {
      setMessage(error.message);
    }
  }

  if (status === "sent") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-line2 bg-s1 px-[18px] py-4 text-left">
        <span className="text-sm leading-normal text-tx2">
          Link sent to <span className="text-tx">{email}</span>. Open it on this device; it expires in{" "}
          <span className="font-mono">1 hour</span>.
        </span>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="h-11 shrink-0 px-1 text-sm font-medium text-t-sky"
        >
          Change
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
      {status === "error" && <p className="m-0 text-left text-[13px] text-rose">{message}</p>}
    </>
  );
}
