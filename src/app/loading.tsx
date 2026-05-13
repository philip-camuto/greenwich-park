export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--bg-group)]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-10 pt-6 sm:px-8 sm:pt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-6 lg:px-10 lg:pb-14">
        <header className="px-4 lg:col-span-2 lg:px-0">
          <div className="hidden lg:block">
            <Bar w="8rem" h="13px" />
          </div>
          <div className="mt-2 flex flex-col gap-2">
            <Bar w="min(38rem, 100%)" h="56px" />
            <Bar w="14rem" h="15px" />
          </div>
        </header>
        <div className="lg:col-span-2 lg:max-w-[520px]">
          <Bar w="100%" h="36px" />
        </div>
        <section className="flex flex-col gap-5 lg:gap-6">
          <Card className="lg:px-6 lg:py-6">
            <Bar w="14rem" h="44px" />
            <Bar w="6rem" h="20px" />
            <Bar w="min(28rem, 100%)" h="20px" />
          </Card>
          <Card className="lg:px-6 lg:py-5">
            <div className="flex justify-end">
              <Bar w="5rem" h="36px" />
            </div>
            <Bar w="100%" h="14px" />
            <div className="flex justify-between">
              {Array.from({ length: 5 }).map((_, i) => (
                <Bar key={i} w="2.5rem" h="12px" />
              ))}
            </div>
            <Bar w="min(20rem, 80%)" h="16px" />
          </Card>
          <Card>
            <Bar w="100%" h="44px" />
            <Bar w="100%" h="44px" />
            <Bar w="100%" h="44px" />
            <Bar w="100%" h="44px" />
          </Card>
        </section>
        <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
          <Card className="lg:px-6 lg:py-6">
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
    <div className={`flex flex-col gap-3 rounded-[12px] bg-[var(--bg-surface)] px-4 py-4 ${className}`}>
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
        borderRadius: 4,
      }}
    />
  );
}
