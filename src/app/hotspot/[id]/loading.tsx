// Matches the real hotspot page's max-width and card cadence so the
// transition from skeleton -> real content is a quiet swap of fill, not a
// reflow. Without this file, Next falls back to the previous page's frozen
// UI while the server component fetches the forecast + observation.

export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--bg-group)] flex justify-center">
      <div className="w-full max-w-[640px] px-4 sm:px-8 pt-6 sm:pt-12 pb-12 flex flex-col gap-4">
        <Bar w="3.5rem" h="14px" />

        <header className="px-4 flex flex-col gap-2">
          <Bar w="16rem" h="34px" />
          <Bar w="20rem" h="14px" />
        </header>

        <Card className="min-h-[226px]">
          <Bar w="8rem" h="11px" />
          <Bar w="11rem" h="84px" />
          <Bar w="min(28rem, 100%)" h="22px" />
        </Card>

        <div className="flex flex-col gap-2">
          <Bar w="7rem" h="11px" />
          <Card className="min-h-[246px]">
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
        </div>

        <div className="px-4 flex flex-col gap-1.5">
          <Bar w="100%" h="13px" />
          <Bar w="100%" h="13px" />
          <Bar w="60%" h="13px" />
        </div>
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
