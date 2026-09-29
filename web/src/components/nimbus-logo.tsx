import { Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

export function NimbusLogo({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25",
          size === "lg" ? "size-10" : "size-7",
        )}
      >
        <Cloud className={size === "lg" ? "size-5" : "size-4"} strokeWidth={2.25} />
      </span>
      <span className={size === "lg" ? "text-2xl" : "text-base"}>Nimbus</span>
    </span>
  );
}
