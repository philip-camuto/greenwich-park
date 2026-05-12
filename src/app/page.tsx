import { AvenueMap } from "@/components/AvenueMap";
import { BestTimeCallout } from "@/components/BestTimeCallout";
import { DemandScore } from "@/components/DemandScore";
import { ForecastChart } from "@/components/ForecastChart";
import { actionCopyFor, verdictFor } from "@/lib/copy";
import { buildForecastForGreenwich } from "@/lib/forecast";
import { getOrRefreshObservation } from "@/lib/ingest";
import type { DemandCategory } from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function localDateLabel(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export default async function Home() {
  const [{ observation }, forecast] = await Promise.all([
    getOrRefreshObservation(),
    buildForecastForGreenwich(),
  ]);

  const category = observation.computedCategory as DemandCategory;
  const confidence = observation.computedConfidence as
    | "low"
    | "medium"
    | "high";
  const action = actionCopyFor({
    currentScore: observation.computedScore,
    bestTime: forecast.bestTime,
  });

  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--fg)] flex justify-center">
      <div className="w-full max-w-[640px] px-6 sm:px-12 pt-12 sm:pt-24 pb-12 flex flex-col gap-8">
        <DemandScore
          score={observation.computedScore}
          category={category}
          observedAt={observation.observedAt}
          confidence={confidence}
          actionCopy={action}
          localDateLabel={localDateLabel(observation.observedAt)}
        />

        <div className="border-t border-[var(--hairline)]" />

        <section className="flex flex-col gap-3">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)]">
            Forecast · Next 4 Hours
          </div>
          <ForecastChart points={forecast.points} bestTime={forecast.bestTime} />
        </section>

        <div className="border-t border-[var(--hairline)]" />

        <section className="flex flex-col gap-3">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)]">
            Greenwich Avenue
          </div>
          <AvenueMap
            category={category}
            score={observation.computedScore}
            verdict={verdictFor(category)}
          />
        </section>

        <div className="border-t border-[var(--hairline)]" />

        <section className="flex flex-col gap-3">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)]">
            Best in Next 4 Hours
          </div>
          <BestTimeCallout
            bestTime={forecast.bestTime}
            currentScore={observation.computedScore}
          />
        </section>

        <div className="border-t border-[var(--hairline)]" />

        <footer className="mono text-[10px] tracking-[0.18em] uppercase text-[var(--muted)] leading-relaxed">
          Public data + heuristics. Not a guarantee of availability.
        </footer>
      </div>
    </main>
  );
}
