import { NimbusLogo } from "@/components/nimbus-logo";
import { LoginForm } from "./login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6">
      {/* Soft sky glow behind the card */}
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <NimbusLogo size="lg" />
          <p className="mt-3 text-sm text-muted-foreground">Opportunities, the moment they form.</p>
        </div>
        <div className="rounded-2xl border bg-card/70 p-6 shadow-xl shadow-black/20 backdrop-blur">
          <h1 className="mb-1 text-lg font-semibold">Sign in</h1>
          <p className="mb-5 text-sm text-muted-foreground">Nimbus is invite-only. Enter the email you were invited with.</p>
          <LoginForm linkError={searchParams.error === "link"} />
        </div>
      </div>
    </main>
  );
}
