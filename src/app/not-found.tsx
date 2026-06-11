import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[560px] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="mono text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
        404
      </div>
      <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-[var(--label-primary)]">
        No such page
      </h1>
      <p className="text-[14px] leading-relaxed text-[var(--label-secondary)]">
        Whatever was here isn&apos;t. The demand score is still live on the
        home page.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--label-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
      >
        Back to the score
      </Link>
    </main>
  );
}
