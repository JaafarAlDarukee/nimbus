// Development only: each app screen with sample data, to compare against the design files
// (the in-app browser can't sign in). Returns 404 in production.
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CHECKED_AT, SAMPLES } from "./samples";

export default async function PreviewPage(props: PageProps<"/auth/preview/[screen]">) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { screen } = await props.params;
  const sample = SAMPLES[screen];
  if (!sample) notFound();
  return (
    <AppShell lastChecked={CHECKED_AT} telegramOn isAdmin={false} previewPath={sample.path}>
      {sample.render()}
    </AppShell>
  );
}
