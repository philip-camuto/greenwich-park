import { formatGreenwichTime } from "@/lib/copy";

type Props = {
  bestTime: { timestamp: string; localHour: number; score: number } | null;
  currentScore: number;
};

export function BestTimeCallout({ bestTime, currentScore }: Props) {
  if (!bestTime) return null;
  const improvement = currentScore - bestTime.score;
  if (improvement <= 5) {
    return (
      <p className="display italic font-light text-[18px] text-[var(--fg)] leading-[1.4]">
        Right now is about as good as it gets in the next 4 hours.
      </p>
    );
  }
  return (
    <p className="display italic font-light text-[18px] text-[var(--fg)] leading-[1.4]">
      Try around{" "}
      <span className="not-italic">{formatGreenwichTime(bestTime.timestamp)}</span>{" "}
      <span className="text-[var(--muted)]">for easier parking.</span>
    </p>
  );
}
