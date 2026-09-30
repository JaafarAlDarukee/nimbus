import Link from "next/link";

/** Stand-in for screens still being built from the design, so the top bar never leads nowhere. */
export function ComingSoon({ title, italic, line }: { title: string; italic: string; line: string }) {
  return (
    <main className="relative mx-auto flex max-w-[928px] flex-col items-center gap-3.5 px-4 pb-[120px] pt-16 text-center sm:px-6">
      <span className="animate-fade-up flex h-[30px] items-center gap-2 rounded-full border border-line px-3 text-[13px] text-tx2">
        <span className="size-1.5 rounded-full bg-t-dawn" />
        Being built next
      </span>
      <h1
        className="animate-fade-up m-0 text-[44px] font-normal leading-none tracking-[-.035em] sm:text-[60px]"
        style={{ fontFamily: "var(--font-newsreader), Georgia, serif", animationDelay: "60ms" }}
      >
        {title} <span className="italic text-t-sky">{italic}</span>
      </h1>
      <p className="animate-fade-up m-0 max-w-md text-[15px] text-tx2" style={{ animationDelay: "120ms" }}>
        {line}
      </p>
      <Link
        href="/"
        className="animate-fade-up mt-3 flex h-[38px] items-center rounded-full border border-line px-4 text-[13px] font-medium !text-tx2 hover:border-l-sky hover:!text-tx"
        style={{ animationDelay: "180ms" }}
      >
        Back to opportunities
      </Link>
    </main>
  );
}
