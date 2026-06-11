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
    <main className="flex min-h-dvh justify-center bg-[var(--bg-group)]">
      <div className="flex w-full max-w-[640px] flex-col gap-4 px-4 pb-12 pt-12 sm:px-8">
        <header className="rounded-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] p-5">
          <p className="mono mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
            Data pipeline
          </p>
          <h1 className="text-[28px] font-semibold leading-tight">
            No signal
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--label-secondary)]">
            We couldn&apos;t reach our data sources just now. Public APIs occasionally hiccup.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 min-h-[40px] rounded-[6px] bg-[var(--label-primary)] px-4 py-2 text-[15px] font-semibold text-[var(--bg-group)]"
          >
            Try again
          </button>
        </header>
      </div>
    </main>
  );
}
