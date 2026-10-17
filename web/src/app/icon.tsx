import { appIcon } from "@/lib/app-icon";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return appIcon(size.width);
}
