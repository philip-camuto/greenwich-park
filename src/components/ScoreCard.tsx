import { AnimatedNumber } from "./AnimatedNumber";
import { Card } from "./Card";
import type { Confidence, DemandCategory } from "@/lib/model/types";
import { verdictFor } from "@/lib/copy";

type Props = {
  score: number;
  category: DemandCategory;
  confidence?: Confidence;
  actionCopy: string;
};

const STATE_VAR: Record<DemandCategory, string> = {
  green: "var(--state-quiet)",
  yellow: "var(--state-busy)",
  red: "var(--state-tough)",
};

export function ScoreCard({ score, category, confidence, actionCopy }: Props) {
  const accent = STATE_VAR[category];
  const verdict = verdictFor(category);
  const lowSignal = confidence === "low";

  return (
    <Card className="flex min-h-[200px] flex-col gap-3 lg:px-6 lg:py-6">
      <div className="flex items-start justify-between gap-5">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--label-secondary)]">
            Demand
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <AnimatedNumber
              value={score}
              className="display text-[64px] font-semibold leading-[0.92] tracking-normal tabular-nums lg:text-[76px]"
              style={{ color: accent, transition: "color 500ms ease-out" }}
            />
            <span className="text-[22px] font-semibold leading-none tracking-normal text-[var(--label-secondary)] lg:text-[26px]">
              /100
            </span>
          </div>
        </div>
        <div
          className="mt-1 rounded-full px-3 py-1 text-[13px] font-semibold"
          style={{
            color: accent,
            backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
            transition:
              "color 500ms ease-out, background-color 500ms ease-out",
          }}
        >
          {verdict}
        </div>
      </div>
      <p className="text-[17px] leading-snug text-[var(--label-primary)] lg:max-w-[32rem] lg:text-[20px]">
        {actionCopy}
      </p>
      {lowSignal && (
        <p className="text-[13px] text-[var(--label-tertiary)] mt-1">
          Limited signal right now.
        </p>
      )}
    </Card>
  );
}
