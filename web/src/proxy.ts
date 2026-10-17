import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/next-path";

// Signed-out visitors may see these: sign-in, the legal pages, and the app icons and manifest
const PUBLIC_PATHS = ["/login", "/auth", "/privacy", "/terms", "/icon", "/apple-icon", "/manifest.webmanifest"];

/**
 * Runs before every page: keeps the Supabase login session fresh and sends anyone who isn't
 * signed in to /login. This is only the first gate; the database's own row-level security is
 * what actually protects the data.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    // Remember where they were going (a role opened from a Telegram alert) for after signing in
    const next = safeNext(path + request.nextUrl.search);
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    return NextResponse.redirect(login);
  }
  if (user && path === "/login") {
    const next = safeNext(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next ?? "/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
