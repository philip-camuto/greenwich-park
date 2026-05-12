export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--bg-group)] flex justify-center">
      <div className="w-full max-w-[640px] px-4 sm:px-8 pt-6 sm:pt-12 pb-12 flex flex-col gap-4">
        <header className="px-4 flex flex-col gap-2">
          <Bar w="20rem" h="34px" />
          <Bar w="14rem" h="13px" />
        </header>
        <Bar w="100%" h="36px" />
        <Card>
          <Bar w="14rem" h="28px" />
          <Bar w="5rem" h="17px" />
          <Bar w="18rem" h="17px" />
        </Card>
        <Card>
          <Bar w="100%" h="44px" />
          <Bar w="100%" h="44px" />
          <Bar w="100%" h="44px" />
          <Bar w="100%" h="44px" />
        </Card>
        <Card>
          <Bar w="100%" h="120px" />
        </Card>
        <Card>
          <Bar w="100%" h="320px" />
        </Card>
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-[12px] px-4 py-4 flex flex-col gap-3">
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
