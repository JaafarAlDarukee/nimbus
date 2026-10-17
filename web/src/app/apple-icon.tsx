import { appIcon } from "@/lib/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon on iPhones ("Add to Home Screen"). */
export default function AppleIcon() {
  return appIcon(size.width);
}
