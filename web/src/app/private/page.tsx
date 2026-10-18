import { signOut } from "@/app/(app)/profile/actions";
import { Brand, StarField } from "@/components/brand";

/** Where everyone but the owner lands while Nimbus is private (lib/access.ts PRIVATE). */
export default function PrivatePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-5 py-10 text-center text-tx">
      <StarField count={50} seed={9} />
      <div className="relative flex max-w-[480px] flex-col items-center gap-5">
        <Brand />
        <h1 className="m-0 font-serif text-[40px] font-normal leading-tight tracking-[-0.03em]">Nimbus is private now</h1>
        <p className="m-0 text-[16px] leading-normal text-tx2">It&apos;s run for one person at the moment. Thanks for trying it.</p>
        <form action={signOut}>
          <button type="submit" className="h-11 cursor-pointer rounded-xl border border-line2 px-5 text-[15px] text-tx2 hover:text-tx">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
