import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { Card } from "@/components/Card";
import { ForecastChart } from "@/components/ForecastChart";
import { SectionCaption } from "@/components/SectionCaption";
import { ScoreCard } from "@/components/ScoreCard";
import { actionCopyFor } from "@/lib/copy";
import {
  bestTimeWithin,
  buildForecastForGreenwich,
  type Forecast,
} from "@/lib/forecast";
import { hotspotById } from "@/lib/hotspots";
import { getObservationForDisplay } from "@/lib/ingest";
import { blockSupply } from "@/lib/inventory/block-supply";
import { perBlockScores, scoreBlock, blockProfiles } from "@/lib/per-block";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function forecastForBlock(
  forecast: Forecast,
  blockId: string,
  hours: { open: number; close: number },
): Forecast {
  const profile = blockProfiles[blockId];
  if (!profile) return forecast;
  const points = forecast.points.map((p) => {
    const block = scoreBlock(p.score, profile, {
      hour: p.localHour,
      dayOfWeek: p.inputs?.dayOfWeek ?? 0,
    });
    return {
      ...p,
      score: block.score,
      category: block.category,
    };
  });
  // Best time only while the anchor business is open — "come at midnight"
  // is never the right answer for a store that closed at 6pm.
  const bestTime = bestTimeWithin(points, hours.open, hours.close);
  return { ...forecast, points, bestTime };
}

export default async function HotspotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hotspot = hotspotById(id);
  if (!hotspot) notFound();

  const [{ observation }, forecast] = await Promise.all([
    getObservationForDisplay(),
    buildForecastForGreenwich(),
  ]);

  const blockScores = perBlockScores(observation.computedScore, {
    hour: observation.hour,
    dayOfWeek: observation.dayOfWeek,
  });
  const block = blockScores[hotspot.blockId];
  const supply = blockSupply(hotspot.blockId);
  const blockForecast = forecastForBlock(
    forecast,
    hotspot.blockId,
    hotspot.hours,
  );

  const action = actionCopyFor({
    currentScore: block.score,
    bestTime: blockForecast.bestTime,
  });

  return (
    <main className="flex min-h-dvh justify-center bg-[var(--bg-group)]">
      <div className="flex w-full max-w-[760px] flex-col gap-4 px-4 pb-12 pt-6 sm:px-8 sm:pt-10">
        <BackLink href="/" />

        <header className="border-b border-[var(--separator)] pb-4">
          <p className="mono mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
            Block detail
          </p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-[var(--label-primary)]">
            {hotspot.name}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--label-secondary)]">
            {hotspot.address}, {hotspot.subLabel}
          </p>
        </header>

        <ScoreCard
          score={block.score}
          category={block.category}
          confidence={
            observation.computedConfidence as "low" | "medium" | "high"
          }
          actionCopy={action}
        />

        <div>
          <SectionCaption>{`Next ${blockForecast.windowHours} Hours`}</SectionCaption>
          <Card className="min-h-[246px]">
            <ForecastChart
              points={blockForecast.points}
              bestTime={blockForecast.bestTime}
            />
          </Card>
        </div>

        <p className="text-[13px] leading-relaxed text-[var(--label-secondary)]">
          This block starts from the Ave-wide GLM demand surface, then
          re-weights for its own anchor businesses, metered curb capacity, and
          side-street relief at the current hour.
        </p>

        {supply && (
          <p className="mono text-[11px] leading-relaxed text-[var(--label-tertiary)]">
            OSM-measured supply: about {supply.onStreetSpaces} on-street spaces
            {supply.publicSpacesWithin5min > 0 &&
              `, ${supply.publicSpacesWithin5min} public lot spaces within a 5-min walk`}
            {supply.nearestLotWalkMeters != null &&
              ` (nearest ${supply.nearestLotWalkMeters} m)`}
          </p>
        )}
      </div>
    </main>
  );
}
