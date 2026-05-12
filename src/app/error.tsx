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
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--fg)] flex justify-center">
      <div className="w-full max-w-[640px] px-6 sm:px-12 pt-12 sm:pt-24 pb-12 flex flex-col gap-6">
        <div className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)]">
          Greenwich Avenue · No signal
        </div>
        <p className="display italic font-light text-[20px] sm:text-[24px] leading-[1.35] text-[var(--fg)]">
          We couldn&rsquo;t reach our data sources just now. Public APIs occasionally hiccup.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mono text-[11px] tracking-[0.25em] uppercase text-[var(--fg)] border border-[var(--hairline)] px-4 py-3 self-start min-h-[44px] hover:bg-[var(--hairline)] transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
