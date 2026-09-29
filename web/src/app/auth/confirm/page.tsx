"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

/**
 * Where approval and login emails land. Handles every link shape Supabase sends:
 *   #access_token=…&refresh_token=…   (approval emails, sent from the admin's browser)
 *   ?token_hash=…&type=email          (custom email templates, once our own sender is set up)
 *   ?code=…                           (links requested in this same browser)
 */
export default function ConfirmPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);

    async function confirm() {
      let error: unknown = null;
      if (hash.get("access_token") && hash.get("refresh_token")) {
        ({ error } = await supabase.auth.setSession({
          access_token: hash.get("access_token")!,
          refresh_token: hash.get("refresh_token")!,
        }));
      } else if (query.get("token_hash")) {
        ({ error } = await supabase.auth.verifyOtp({ token_hash: query.get("token_hash")!, type: "email" }));
      } else if (query.get("code")) {
        ({ error } = await supabase.auth.exchangeCodeForSession(query.get("code")!));
      } else {
        error = hash.get("error_description") ?? "missing token";
      }
      if (error) {
        setFailed(true);
        return;
      }
      router.replace("/");
      router.refresh();
    }
    void confirm();
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-6" style={{ background: "var(--glow), var(--bg)" }}>
      <div className="flex flex-col items-center gap-5 text-center">
        <Brand />
        {failed ? (
          <>
            <p className="m-0 font-serif text-3xl">That link has expired.</p>
            <p className="m-0 max-w-sm text-sm text-tx2">Links work once and last an hour. Ask for a new one from the sign-in page.</p>
            <a href="/login" className="rounded-xl bg-sky px-5 py-3 text-sm font-medium !text-on-sky">
              Back to sign in
            </a>
          </>
        ) : (
          <p className="m-0 text-sm text-tx2">Signing you in…</p>
        )}
      </div>
    </main>
  );
}
