"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to Vercel logs without leaking to the client.
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh flex flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="px-6 pt-6 sm:pt-8 flex items-center justify-between">
        <span className="mono text-[10px] tracking-[0.25em] uppercase text-[var(--muted)]">
          41.026°N · 73.628°W
        </span>
        <span className="mono text-[10px] tracking-[0.25em] uppercase text-[var(--muted)]">
          Greenwich Park
        </span>
      </header>
      <div className="mx-6 mt-6 border-t border-[var(--hairline)]" />

      <section className="flex-1 flex flex-col justify-center px-6 gap-4">
        <div className="mono text-[10px] tracking-[0.25em] uppercase text-[var(--muted)]">
          No signal
        </div>
        <p className="text-xl sm:text-2xl leading-snug max-w-md">
          The demand model couldn&rsquo;t fetch its inputs this minute. Public
          data sources can be flaky.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mono text-[11px] tracking-[0.25em] uppercase text-[var(--fg)] border border-[var(--hairline)] rounded-sm px-4 py-3 self-start min-h-[44px] hover:bg-[var(--hairline)] transition-colors"
        >
          Try again
        </button>
      </section>

      <footer className="mt-auto px-6 pt-12 pb-8 mono text-[10px] tracking-[0.18em] uppercase text-[var(--muted)]">
        Public data + heuristics. Not a guarantee of availability.
      </footer>
    </main>
  );
}
