import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { Card } from "@/components/Card";
import { ForecastChart } from "@/components/ForecastChart";
import { SectionCaption } from "@/components/SectionCaption";
import { ScoreCard } from "@/components/ScoreCard";
import { actionCopyFor } from "@/lib/copy";
import { buildForecastForGreenwich } from "@/lib/forecast";
import { hotspotById } from "@/lib/hotspots";
import { getOrRefreshObservation } from "@/lib/ingest";
import { perBlockScores } from "@/lib/per-block";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HotspotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hotspot = hotspotById(id);
  if (!hotspot) notFound();

  const [{ observation }, forecast] = await Promise.all([
    getOrRefreshObservation(),
    buildForecastForGreenwich(),
  ]);

  const blockScores = perBlockScores(observation.computedScore);
  const block = blockScores[hotspot.blockId];

  const action = actionCopyFor({
    currentScore: block.score,
    bestTime: forecast.bestTime,
  });

  return (
    <main className="min-h-dvh bg-[var(--bg-group)] flex justify-center">
      <div className="w-full max-w-[640px] px-4 sm:px-8 pt-6 sm:pt-12 pb-12 flex flex-col gap-4">
        <BackLink href="/" />

        <header className="px-4">
          <h1 className="display text-[34px] font-bold leading-tight tracking-tight text-[var(--label-primary)]">
            {hotspot.name}
          </h1>
          <p className="text-[13px] text-[var(--label-secondary)] mt-1">
            {hotspot.address} · {hotspot.subLabel}
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
          <SectionCaption>Next 4 Hours</SectionCaption>
          <Card>
            <ForecastChart points={forecast.points} bestTime={forecast.bestTime} />
          </Card>
        </div>

        <p className="text-[13px] text-[var(--label-secondary)] px-4 leading-snug">
          Per-block scores currently use stylized offsets. Phase 3 (FOIA
          citation data) replaces them with measured demand.
        </p>
      </div>
    </main>
  );
}
