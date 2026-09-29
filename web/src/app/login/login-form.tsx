"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "not-approved" | "requesting" | "requested" | "error";

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
        // Accounts are only created for approved emails: Supabase checks the approval list
        // itself (hook_before_user_created) and refuses everyone else
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (!error) {
      setStatus("sent");
    } else if (/not been approved|signups not allowed|403/i.test(error.message)) {
      setStatus("not-approved");
    } else if (/rate|seconds|too many/i.test(error.message)) {
      setStatus("error");
      setMessage("Too many login emails just now. Wait a minute and try again.");
    } else {
      setStatus("error");
      setMessage(error.message);
    }
  }

  async function requestAccess() {
    setStatus("requesting");
    const { error } = await createClient().from("access_requests").insert({ email: email.trim() });
    // A duplicate means they already asked; treat it the same as a fresh request
    if (!error || error.code === "23505") {
      setStatus("requested");
    } else {
      setStatus("error");
      setMessage("Couldn't send your request. Check the email and try again.");
    }
  }

  const box = "flex items-center justify-between gap-3 rounded-[14px] border border-line2 bg-s1 px-[18px] py-4 text-left";

  if (status === "sent") {
    return (
      <div className={box}>
        <span className="text-sm leading-normal text-tx2">
          Link sent to <span className="text-tx">{email}</span>. Open it on this device; it expires in{" "}
          <span className="font-mono">1 hour</span>.
        </span>
        <button type="button" onClick={() => setStatus("idle")} className="h-11 shrink-0 px-1 text-sm font-medium text-t-sky">
          Change
        </button>
      </div>
    );
  }

  if (status === "not-approved" || status === "requesting") {
    return (
      <div className={box}>
        <span className="text-sm leading-normal text-tx2">
          <span className="text-tx">{email}</span> isn&apos;t on Nimbus yet. Ask for access and you&apos;ll get an email
          once you&apos;re approved.
        </span>
        <button
          type="button"
          onClick={requestAccess}
          disabled={status === "requesting"}
          className="h-11 shrink-0 whitespace-nowrap rounded-[10px] bg-sky px-4 text-sm font-medium text-on-sky disabled:opacity-60"
        >
          {status === "requesting" ? "Sending…" : "Request access"}
        </button>
      </div>
    );
  }

  if (status === "requested") {
    return (
      <div className={box}>
        <span className="text-sm leading-normal text-tx2">
          Request sent for <span className="text-tx">{email}</span>. You&apos;ll get an email as soon as it&apos;s approved.
        </span>
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
