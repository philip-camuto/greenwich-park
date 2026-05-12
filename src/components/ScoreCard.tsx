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
    <Card className="flex flex-col gap-2">
      <h1
        className="display font-semibold leading-tight tracking-tight"
        style={{ color: accent, fontSize: "28px" }}
      >
        {verdict}
      </h1>
      <div className="mono text-[17px] font-medium text-[var(--label-secondary)] tabular-nums">
        {score} / 100
      </div>
      <p className="text-[17px] leading-snug text-[var(--label-primary)] mt-1">
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
