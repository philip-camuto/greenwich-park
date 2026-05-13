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
import { getObservationForDisplay } from "@/lib/ingest";
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

function blockContext(at: Date | string): { hour: number; dayOfWeek: number } {
  const d = typeof at === "string" ? new Date(at) : at;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: GREENWICH_TZ,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    hour: parseInt(parts.hour ?? "0", 10),
    dayOfWeek: dayMap[parts.weekday ?? "Sun"] ?? 0,
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; time?: string }>;
}) {
  const { day, time } = await searchParams;
  const dayParam = parseDayParam(day, new Date(), time);

  const [{ observation }, forecast] = await Promise.all([
    getObservationForDisplay(),
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

  const blockScores = perBlockScores(globalScore, blockContext(displayedAt));
  const action = actionCopyFor({
    currentScore: globalScore,
    bestTime: forecast.bestTime,
  });

  return (
    <main className="min-h-dvh bg-[var(--bg-group)]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-10 pt-6 sm:px-8 sm:pt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-6 lg:px-10 lg:pb-14">
        <header className="px-4 lg:col-span-2 lg:flex lg:items-end lg:justify-between lg:px-0">
          <div>
            <p className="mb-2 hidden text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--label-secondary)] lg:block">
              Live demand model
            </p>
            <h1 className="display max-w-[720px] text-[34px] font-bold leading-tight tracking-tight text-[var(--label-primary)] lg:text-[56px]">
              Parking on Greenwich Avenue
            </h1>
          </div>
          <p className="mt-1 text-[13px] text-[var(--label-secondary)] lg:mb-2 lg:text-right lg:text-[15px]">
            Greenwich · CT · {titleSubtitle(displayedAt)}
          </p>
        </header>

        <div className="lg:col-span-2 lg:max-w-[520px]">
          <DaySegmentedControl />
        </div>

        <section className="flex flex-col gap-5 lg:gap-6">
          <ScoreCard
            score={globalScore}
            category={category}
            confidence={confidence}
            actionCopy={action}
          />

          <div>
            <SectionCaption>Next 4 Hours</SectionCaption>
            <Card className="lg:px-6 lg:py-5">
              <ForecastChart
                key={forecast.points[0]?.timestamp ?? "empty"}
                points={forecast.points}
                bestTime={forecast.bestTime}
              />
            </Card>
          </div>

          <div>
            <SectionCaption>Hotspots</SectionCaption>
            <HotspotList perBlock={blockScores} />
            <p className="mt-2 px-4 text-[13px] leading-snug text-[var(--label-secondary)] lg:px-0">
              Block scores combine anchor businesses, curb capacity, time of
              day, and side-street relief. Phase 3 will replace the heuristics
              with measured demand.
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
          <div>
            <SectionCaption>Greenwich Avenue</SectionCaption>
            <Card className="lg:px-6 lg:py-6">
              <AvenueMap
                category={category}
                perBlock={blockScores}
                score={globalScore}
                verdict={verdictFor(category)}
              />
            </Card>
          </div>

          <Card className="hidden lg:block">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="mono text-[22px] font-semibold tabular-nums text-[var(--label-primary)]">
                  {forecast.points.length}
                </div>
                <div className="mt-1 text-[12px] font-medium text-[var(--label-secondary)]">
                  samples
                </div>
              </div>
              <div>
                <div className="mono text-[22px] font-semibold tabular-nums text-[var(--label-primary)]">
                  4h
                </div>
                <div className="mt-1 text-[12px] font-medium text-[var(--label-secondary)]">
                  horizon
                </div>
              </div>
              <div>
                <div className="mono text-[22px] font-semibold tabular-nums text-[var(--label-primary)]">
                  {confidence}
                </div>
                <div className="mt-1 text-[12px] font-medium text-[var(--label-secondary)]">
                  signal
                </div>
              </div>
            </div>
          </Card>
        </aside>

        <footer className="px-4 text-[13px] leading-relaxed text-[var(--label-tertiary)] lg:col-span-2 lg:px-0">
          Public data + heuristics. Not a guarantee of availability.
        </footer>
      </div>
    </main>
  );
}
