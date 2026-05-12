// Server-rendered skeleton shown during page server-render. Mirrors the
// cockpit rhythm exactly so the swap from skeleton → live data doesn't
// reflow or jump.

export default function Loading() {
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

      {/* Score skeleton */}
      <section className="mt-10 sm:mt-14 px-6 flex flex-col gap-3">
        <div className="flex justify-between">
          <Bar w="9rem" />
          <Bar w="3.5rem" />
        </div>
        <div className="flex items-end gap-5">
          <Bar w="9rem" h="clamp(8rem, 38vw, 14rem)" />
          <div className="pb-3 sm:pb-4 flex flex-col gap-2">
            <Bar w="11rem" h="1.25rem" />
            <Bar w="7rem" h="0.7rem" />
          </div>
        </div>
      </section>

      <div className="mx-6 mt-10 sm:mt-14 border-t border-[var(--hairline)]" />

      <section className="px-6 mt-6 sm:mt-8">
        <Bar w="6rem" />
        <div className="mt-3" style={{ height: "clamp(150px, 22vh, 240px)" }}>
          <Bar w="100%" h="100%" />
        </div>
      </section>

      <div className="mx-6 mt-8 border-t border-[var(--hairline)]" />

      <section className="px-6 mt-6">
        <Bar w="8rem" />
        <div className="mt-3">
          <Bar w="16rem" h="1.25rem" />
        </div>
      </section>

      <footer className="mt-auto px-6 pt-12 pb-8 mono text-[10px] tracking-[0.18em] uppercase text-[var(--muted)]">
        Public data + heuristics. Not a guarantee of availability.
      </footer>
    </main>
  );
}

function Bar({ w, h = "0.7rem" }: { w: string; h?: string }) {
  return (
    <div
      className="bg-[var(--hairline)] opacity-60"
      style={{ width: w, height: h, borderRadius: 2 }}
    />
  );
}
