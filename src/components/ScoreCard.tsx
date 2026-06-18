import { AnimatedNumber } from "./AnimatedNumber";
import { Card } from "./Card";
import type { Confidence, DemandCategory } from "@/lib/model/types";
import { formatGreenwichTime, verdictFor } from "@/lib/copy";

type Props = {
  score: number;
  category: DemandCategory;
  confidence?: Confidence;
  actionCopy: string;
  // ISO timestamp of the slot being shown. When provided, renders a small
  // "· 4:49 AM" accent on the eyebrow so the score and the time it models
  // for stay visually tied together.
  modeledAt?: string;
};

const STATE_VAR: Record<DemandCategory, string> = {
  green: "var(--state-quiet)",
  yellow: "var(--state-busy)",
  red: "var(--state-tough)",
};

export function ScoreCard({
  score,
  category,
  confidence,
  actionCopy,
  modeledAt,
}: Props) {
  const accent = STATE_VAR[category];
  const verdict = verdictFor(category);
  const lowSignal = confidence === "low";
  const modeledTimeLabel = modeledAt ? formatGreenwichTime(modeledAt) : null;

  return (
    <Card className="flex min-h-[226px] flex-col justify-between gap-5 lg:px-5 lg:py-5">
      <div className="flex items-start justify-between gap-5">
        <div>
          <h2 className="mono text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
            Demand score
            {modeledTimeLabel && (
              <span className="ml-2 text-[var(--label-secondary)]">
                Updated {modeledTimeLabel}
              </span>
            )}
          </h2>
          <div className="mt-3 flex items-end gap-1.5">
            <AnimatedNumber
              value={score}
              className="mono text-[82px] font-semibold leading-[0.82] tracking-[-0.055em] tabular-nums lg:text-[104px]"
              style={{ color: accent, transition: "color 500ms ease-out" }}
            />
            <span className="mono mb-1.5 flex items-baseline text-[22px] font-medium leading-none tracking-[-0.04em] text-[var(--label-tertiary)] lg:mb-2 lg:text-[26px]">
              <span className="opacity-45">/</span>
              <span className="ml-0.5">100</span>
            </span>
          </div>
        </div>
        <div
          className="rounded-[6px] border px-2.5 py-1 text-[12px] font-semibold"
          style={{
            color: accent,
            backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)`,
            borderColor: `color-mix(in srgb, ${accent} 28%, transparent)`,
            transition:
              "color 500ms ease-out, background-color 500ms ease-out, border-color 500ms ease-out",
          }}
        >
          {verdict}
        </div>
      </div>
      <div className="border-t border-[var(--separator)] pt-4">
        <p className="text-[17px] font-medium leading-snug text-[var(--label-primary)] lg:max-w-[32rem] lg:text-[20px]">
          {actionCopy}
        </p>
        {lowSignal && (
          <p className="mt-2 text-[12px] text-[var(--label-tertiary)]">
            Limited signal right now.
          </p>
        )}
      </div>
    </Card>
  );
}
