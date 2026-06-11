import { LabForm } from "./LabForm";
import { getObservationForDisplay } from "@/lib/ingest";
import { perBlockScores } from "@/lib/per-block";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LabPage() {
  const { observation } = await getObservationForDisplay();
  const perBlock = perBlockScores(observation.computedScore, {
    hour: observation.hour,
    dayOfWeek: observation.dayOfWeek,
  });

  return (
    <main className="min-h-dvh bg-[var(--bg-group)]">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <header className="border-b border-[var(--separator)] pb-4">
          <p className="mono mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
            Hidden calibration
          </p>
          <h1 className="text-[28px] font-semibold tracking-[-0.01em] text-[var(--label-primary)]">
            Greenwich Parking Lab
          </h1>
          <p className="mt-2 max-w-[720px] text-[14px] leading-relaxed text-[var(--label-secondary)]">
            Use this while you are physically on Greenwich Avenue. Log what
            parking actually feels like so the model can learn what each score
            means by block, hour, weather, traffic, and event context.
          </p>
        </header>

        <LabForm
          initialBlockId="lewis__mason"
          model={{
            confidence: observation.computedConfidence,
            observedAt: observation.observedAt.toISOString(),
            score: observation.computedScore,
          }}
          perBlock={Object.fromEntries(
            Object.entries(perBlock).map(([blockId, score]) => [
              blockId,
              { category: score.category, score: score.score },
            ]),
          )}
        />
      </div>
    </main>
  );
}
