"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type State = { status: "idle" | "sending" | "sent" | "error"; message?: string };

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>(
    linkError ? { status: "error", message: "That login link has expired or was already used. Send a new one." } : { status: "idle" },
  );

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setState({ status: "sending" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Invite-only: never create an account from the login form
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (!error) {
      setState({ status: "sent" });
    } else if (/signups not allowed|not found|user/i.test(error.message)) {
      setState({ status: "error", message: "This email hasn't been invited to Nimbus yet." });
    } else if (/rate|seconds/i.test(error.message)) {
      setState({ status: "error", message: "Too many login emails just now. Wait a minute and try again." });
    } else {
      setState({ status: "error", message: error.message });
    }
  }

  if (state.status === "sent") {
    return (
      <div className="rounded-xl border bg-card/60 p-5 text-center">
        <Mail className="mx-auto mb-3 size-6 text-primary" />
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a login link to <span className="text-foreground">{email}</span>. Open it on this device.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={sendLink} className="space-y-3">
      <Input
        type="email"
        required
        autoFocus
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11"
      />
      <Button type="submit" className="h-11 w-full" disabled={state.status === "sending"}>
        {state.status === "sending" ? <Loader2 className="size-4 animate-spin" /> : "Email me a login link"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  );
}
