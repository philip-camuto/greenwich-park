export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--fg)] flex justify-center">
      <div className="w-full max-w-[640px] px-6 sm:px-12 pt-12 sm:pt-24 pb-12 flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <Bar w="14rem" />
          <Bar w="16rem" h="clamp(40px, 7vw, 56px)" />
          <Bar w="5rem" h="14px" />
          <Bar w="18rem" h="18px" />
        </section>
        <div className="border-t border-[var(--hairline)]" />
        <section className="flex flex-col gap-3">
          <Bar w="9rem" />
          <Bar w="100%" h="clamp(120px, 18vh, 180px)" />
        </section>
        <div className="border-t border-[var(--hairline)]" />
        <section className="flex flex-col gap-3">
          <Bar w="8rem" />
          <Bar w="100%" h="320px" />
        </section>
        <div className="border-t border-[var(--hairline)]" />
        <section className="flex flex-col gap-3">
          <Bar w="10rem" />
          <Bar w="22rem" h="18px" />
        </section>
      </div>
    </main>
  );
}

function Bar({ w, h = "0.7rem" }: { w: string; h?: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        background: "var(--hairline)",
        borderRadius: 2,
      }}
    />
  );
}
