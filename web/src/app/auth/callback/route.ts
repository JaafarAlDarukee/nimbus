import { NextResponse, type NextRequest } from "next/server";
import { NEXT_COOKIE, safeNext } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/server";

/** The login link in the email lands here; swap its one-time code for a session, then go home
 *  (or back to the role a Telegram alert opened). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const next = safeNext(request.cookies.get(NEXT_COOKIE)?.value ? decodeURIComponent(request.cookies.get(NEXT_COOKIE)!.value) : null);
      const response = NextResponse.redirect(`${origin}${next ?? "/"}`);
      response.cookies.delete(NEXT_COOKIE);
      return response;
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
