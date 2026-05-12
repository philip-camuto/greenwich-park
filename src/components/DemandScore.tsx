import type { Confidence, DemandCategory } from "@/lib/model/types";
import { verdictFor } from "@/lib/copy";

type Props = {
  score: number;
  category: DemandCategory;
  observedAt: string | Date;
  confidence?: Confidence;
  actionCopy: string;
  localDateLabel: string; // e.g. "Tue 3:42 PM"
};

const ACCENT_VAR: Record<DemandCategory, string> = {
  green: "var(--accent-quiet)",
  yellow: "var(--accent-busy)",
  red: "var(--accent-tough)",
};

export function DemandScore({
  score,
  category,
  observedAt: _observedAt,
  confidence,
  actionCopy,
  localDateLabel,
}: Props) {
  const accent = ACCENT_VAR[category];
  const verdict = verdictFor(category);
  const lowSignal = confidence === "low";

  return (
    <section className="flex flex-col gap-3">
      <div className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)]">
        Greenwich Avenue · {localDateLabel}
      </div>

      <h1 className="display italic font-normal leading-[1.05] tracking-tight"
        style={{
          color: accent,
          fontSize: "clamp(40px, 7vw, 56px)",
        }}
      >
        {verdict}
      </h1>

      <div className="mono text-[14px] text-[var(--muted)] tracking-tight">
        {score} / 100
      </div>

      <p className="display italic font-light text-[18px] text-[var(--fg)] leading-[1.4] mt-2">
        {actionCopy}
      </p>

      {lowSignal && (
        <p className="mono text-[11px] tracking-[0.15em] uppercase text-[var(--muted)] mt-1">
          Limited signal right now.
        </p>
      )}
    </section>
  );
}
