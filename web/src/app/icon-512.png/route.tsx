import { appIcon } from "@/lib/app-icon";

export const dynamic = "force-static";

/** For the web app manifest (Android home screen). */
export function GET() {
  return appIcon(512);
}
