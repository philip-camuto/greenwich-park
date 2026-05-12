import type { Confidence, DemandCategory } from "@/lib/model/types";

type Props = {
  score: number;
  category: DemandCategory;
  observedAt: string | Date;
  confidence?: Confidence;
};

const STATUS_COPY: Record<DemandCategory, string> = {
  green: "Plenty of parking",
  yellow: "Some spots open",
  red: "Tough to park",
};

const ACCENT_VAR: Record<DemandCategory, string> = {
  green: "var(--green)",
  yellow: "var(--amber)",
  red: "var(--red)",
};

function ageString(observedAt: string | Date, nowMs = Date.now()): string {
  const t = observedAt instanceof Date ? observedAt : new Date(observedAt);
  const ageMin = Math.max(0, Math.round((nowMs - t.getTime()) / 60000));
  if (ageMin === 0) return "just now";
  if (ageMin === 1) return "1 min ago";
  if (ageMin < 60) return `${ageMin} min ago`;
  const h = Math.floor(ageMin / 60);
  return h === 1 ? "1 hour ago" : `${h} hours ago`;
}

export function DemandScore({ score, category, observedAt, confidence }: Props) {
  const accent = ACCENT_VAR[category];
  const showLowSignal = confidence === "low";
  return (
    <section className="flex flex-col gap-3 px-6">
      {/* Label rail */}
      <div className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)] flex justify-between items-center">
        <span>Demand · Greenwich Ave</span>
        <span className="flex items-center gap-2">
          {showLowSignal && (
            <span className="text-[var(--amber)] inline-flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--amber)" }}
              />
              Low signal
            </span>
          )}
          <span>{category.toUpperCase()}</span>
        </span>
      </div>

      {/* The number itself — asymmetric, pushed left so the status can sit to its right at small sizes */}
      <div className="flex items-end gap-5">
        <div
          className="display font-light leading-[0.85] tracking-tight"
          style={{
            color: accent,
            fontSize: "clamp(8rem, 38vw, 14rem)",
          }}
        >
          {score}
        </div>
        <div className="pb-3 sm:pb-4">
          <div className="text-base sm:text-lg text-[var(--fg)] leading-tight">
            {STATUS_COPY[category]}
          </div>
          <div className="mono text-[11px] tracking-[0.15em] uppercase text-[var(--muted)] mt-1">
            Updated {ageString(observedAt)}
          </div>
        </div>
      </div>
    </section>
  );
}
