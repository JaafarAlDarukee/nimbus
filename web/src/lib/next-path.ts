/** Where to go after signing in, e.g. the role a Telegram alert opened (/?open=<id>). Kept in a
 *  cookie between asking for the email and tapping its link. Only paths on this site. */
export const NEXT_COOKIE = "nimbus_next";

export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/login") || value.startsWith("/auth")) return null;
  return value;
}

/** The saved destination, read in the browser (and forgotten). */
export function takeNextCookie(): string | null {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${NEXT_COOKIE}=`))?.slice(NEXT_COOKIE.length + 1);
  document.cookie = `${NEXT_COOKIE}=; path=/; max-age=0`;
  return safeNext(raw ? decodeURIComponent(raw) : null);
}
