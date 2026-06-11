export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--bg-group)]">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6 lg:px-8 lg:pb-10 xl:gap-8 xl:px-12">
        <header className="flex flex-col gap-3 border-b border-[var(--separator)] pb-4 lg:col-span-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Bar w="11rem" h="11px" />
            <div className="mt-2">
              <Bar w="15rem" h="30px" />
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            <Bar w="13rem" h="13px" />
            <Bar w="20rem" h="40px" />
          </div>
        </header>
        <section className="flex flex-col gap-4">
          <Card className="min-h-[226px] lg:px-5 lg:py-5">
            <Bar w="8rem" h="11px" />
            <Bar w="13rem" h="84px" />
            <Bar w="min(28rem, 100%)" h="22px" />
          </Card>
          <Card className="min-h-[246px] lg:px-5 lg:py-5">
            <div className="flex justify-end">
              <Bar w="6rem" h="40px" />
            </div>
            <Bar w="100%" h="10px" />
            <div className="flex justify-between">
              {Array.from({ length: 5 }).map((_, i) => (
                <Bar key={i} w="2.5rem" h="12px" />
              ))}
            </div>
            <Bar w="100%" h="62px" />
          </Card>
          <Card>
            <Bar w="100%" h="54px" />
            <Bar w="100%" h="54px" />
            <Bar w="100%" h="54px" />
            <Bar w="100%" h="54px" />
          </Card>
        </section>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
          <Card className="min-h-[520px] lg:px-5 lg:py-5">
            <Bar w="100%" h="420px" />
          </Card>
          <Card className="hidden lg:block">
            <Bar w="100%" h="22px" />
            <Bar w="100%" h="14px" />
            <Bar w="100%" h="14px" />
            <Bar w="100%" h="14px" />
            <Bar w="100%" h="14px" />
            <Bar w="100%" h="24px" />
          </Card>
        </aside>
      </div>
    </main>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] px-4 py-4 ${className}`}
    >
      {children}
    </div>
  );
}

function Bar({ w, h = "0.7rem" }: { w: string; h?: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        background: "var(--separator)",
        borderRadius: 3,
      }}
    />
  );
}
