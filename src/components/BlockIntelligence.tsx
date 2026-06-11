"use client";

import { AvenueMap } from "./AvenueMap";
import { HotspotList } from "./HotspotList";
import { useScrubState } from "./DemandScrubProvider";
import { verdictFor } from "@/lib/copy";
import type { ForecastPoint } from "@/lib/forecast";
import type { DemandCategory } from "@/lib/model/types";
import { perBlockScores, type BlockContext } from "@/lib/per-block";

type SharedProps = {
  forecastPoints: ForecastPoint[];
  initialContext: BlockContext;
  initialScore: number;
};

function useDisplayedBlocks({
  forecastPoints,
  initialContext,
  initialScore,
}: SharedProps) {
  const { pinnedIdx } = useScrubState();
  const point =
    pinnedIdx != null && pinnedIdx > 0 ? forecastPoints[pinnedIdx] : null;
  const score = point?.score ?? initialScore;
  const context = point
    ? {
        hour: point.localHour,
        dayOfWeek: point.inputs?.dayOfWeek ?? initialContext.dayOfWeek,
      }
    : initialContext;

  return perBlockScores(score, context);
}

export function BlockHotspots(props: SharedProps) {
  const perBlock = useDisplayedBlocks(props);
  return <HotspotList perBlock={perBlock} />;
}

export function BlockMap({
  category,
  forecastPoints,
  initialContext,
  initialScore,
}: SharedProps & { category: DemandCategory }) {
  const perBlock = useDisplayedBlocks({
    forecastPoints,
    initialContext,
    initialScore,
  });
  const point = useScrubState().pinnedIdx;
  const displayedPoint =
    point != null && point > 0 ? forecastPoints[point] : null;
  const score = displayedPoint?.score ?? initialScore;
  const mapCategory = displayedPoint?.category ?? category;
  return (
    <AvenueMap
      category={mapCategory}
      perBlock={perBlock}
      score={score}
      verdict={verdictFor(mapCategory)}
    />
  );
}
