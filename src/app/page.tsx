import { Card } from "@/components/Card";
import { DaySegmentedControl } from "@/components/DaySegmentedControl";
import { ForecastChart } from "@/components/ForecastChart";
import { HotspotList } from "@/components/HotspotList";
import { AvenueMap } from "@/components/AvenueMap";
import { ScoreCard } from "@/components/ScoreCard";
import { SectionCaption } from "@/components/SectionCaption";
import { actionCopyFor, verdictFor } from "@/lib/copy";
import { parseDayParam } from "@/lib/day-param";
import { buildForecastForGreenwich } from "@/lib/forecast";
import { getOrRefreshObservation } from "@/lib/ingest";
import { perBlockScores } from "@/lib/per-block";
import type { DemandCategory } from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function titleSubtitle(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day } = await searchParams;
  const dayParam = parseDayParam(day);

  const [{ observation }, forecast] = await Promise.all([
    getOrRefreshObservation(),
    buildForecastForGreenwich(
      dayParam.kind === "future" ? dayParam.startAt : undefined,
    ),
  ]);

  let globalScore: number;
  let category: DemandCategory;
  let confidence: "low" | "medium" | "high";
  let displayedAt: Date | string;
  if (dayParam.kind === "today") {
    globalScore = observation.computedScore;
    category = observation.computedCategory as DemandCategory;
    confidence = observation.computedConfidence as "low" | "medium" | "high";
    displayedAt = observation.observedAt;
  } else {
    const p0 = forecast.points[0];
    globalScore = p0.score;
    category = p0.category;
    confidence = "medium";
    displayedAt = dayParam.startAt;
  }

  const blockScores = perBlockScores(globalScore);
  const action = actionCopyFor({
    currentScore: globalScore,
    bestTime: forecast.bestTime,
  });

  return (
    <main className="min-h-dvh bg-[var(--bg-group)] flex justify-center">
      <div className="w-full max-w-[640px] px-4 sm:px-8 pt-6 sm:pt-12 pb-12 flex flex-col gap-4">
        <header className="px-4">
          <h1 className="display text-[34px] font-bold leading-tight tracking-tight text-[var(--label-primary)]">
            Parking on Greenwich Avenue
          </h1>
          <p className="text-[13px] text-[var(--label-secondary)] mt-1">
            Greenwich · CT · {titleSubtitle(displayedAt)}
          </p>
        </header>

        <DaySegmentedControl />

        <ScoreCard
          score={globalScore}
          category={category}
          confidence={confidence}
          actionCopy={action}
        />

        <div>
          <SectionCaption>Hotspots</SectionCaption>
          <HotspotList perBlock={blockScores} />
          <p className="text-[13px] text-[var(--label-secondary)] px-4 mt-2 leading-snug">
            Per-block scores currently use stylized offsets. Phase 3 will
            replace them with measured demand.
          </p>
        </div>

        <div>
          <SectionCaption>Next 4 Hours</SectionCaption>
          <Card>
            <ForecastChart points={forecast.points} bestTime={forecast.bestTime} />
          </Card>
        </div>

        <div>
          <SectionCaption>Greenwich Avenue</SectionCaption>
          <Card>
            <AvenueMap
              category={category}
              score={globalScore}
              verdict={verdictFor(category)}
            />
          </Card>
        </div>

        <footer className="text-[13px] text-[var(--label-tertiary)] px-4 mt-4 leading-relaxed">
          Public data + heuristics. Not a guarantee of availability.
        </footer>
      </div>
    </main>
  );
}
