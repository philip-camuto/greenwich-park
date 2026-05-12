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
    <main className="min-h-dvh bg-[var(--bg-group)] flex justify-center">
      <div className="w-full max-w-[640px] px-4 sm:px-8 pt-12 pb-12 flex flex-col gap-4">
        <header className="px-4">
          <h1 className="display text-[28px] font-bold leading-tight">
            No signal
          </h1>
          <p className="text-[17px] mt-2 text-[var(--label-primary)]">
            We couldn&rsquo;t reach our data sources just now. Public APIs occasionally hiccup.
          </p>
        </header>
        <div className="px-4">
          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] px-5 py-2 rounded-[10px] bg-[var(--link)] text-white text-[17px] font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
