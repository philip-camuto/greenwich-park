"use client";

import { Card } from "./Card";
import { useScrubState } from "./DemandScrubProvider";
import { ForecastChart } from "./ForecastChart";
import { ScoreCard } from "./ScoreCard";
import { SectionCaption } from "./SectionCaption";
import { actionCopyFor, formatGreenwichTime } from "@/lib/copy";
import type { Forecast } from "@/lib/forecast";
import type { Confidence, DemandCategory } from "@/lib/model/types";

// Connects the score card and the forecast chart so a single scrub controls
// both: tap, drag, or arrow-key through the chart and the big score, verdict
// pill, modeled time, and action copy all update together. Scrub state lives
// in DemandScrubProvider so the right-rail BreakdownCard sees it too.

type Props = {
  initialScore: number;
  initialCategory: DemandCategory;
  initialConfidence: Confidence;
  initialModeledAt: string;
  forecast: Forecast;
};

export function DemandSection({
  initialScore,
  initialCategory,
  initialConfidence,
  initialModeledAt,
  forecast,
}: Props) {
  const { pinnedIdx, setPinnedIdx } = useScrubState();
  const isScrubbed = pinnedIdx != null && pinnedIdx !== 0;

  // Pinning slot 0 keeps the initial (observation-backed) numbers: swapping
  // to the modeled slot-0 score made the headline jump on a tap that means
  // "now", which read as a glitch.
  const displayedPoint =
    pinnedIdx != null && pinnedIdx > 0 ? forecast.points[pinnedIdx] : null;
  const score = displayedPoint?.score ?? initialScore;
  const category: DemandCategory = displayedPoint?.category ?? initialCategory;
  const modeledAt = displayedPoint?.timestamp ?? initialModeledAt;

  // When scrubbed away from "now", the original action copy ("Won't get
  // easier in the next 4 hours") reads wrong — it's a now-only judgment.
  // Swap to a simple anchored sentence that names the modeled time.
  const action = isScrubbed
    ? `Modeled for ${formatGreenwichTime(modeledAt)}.`
    : actionCopyFor({
        currentScore: score,
        bestTime: forecast.bestTime,
      });

  return (
    <>
      <ScoreCard
        score={score}
        category={category}
        confidence={initialConfidence}
        actionCopy={action}
        modeledAt={modeledAt}
      />

      <div>
        <SectionCaption>{`Next ${forecast.windowHours} Hours`}</SectionCaption>
        <Card className="min-h-[246px] lg:px-5 lg:py-5">
          <ForecastChart
            points={forecast.points}
            bestTime={forecast.bestTime}
            onPinChange={setPinnedIdx}
          />
        </Card>
      </div>
    </>
  );
}
