import { GREENWICH_TZ } from "@/lib/utils/time";

type Props = {
  bestTime: { timestamp: string; localHour: number; score: number } | null;
  currentScore: number;
};

function fmtLocalTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function BestTimeCallout({ bestTime, currentScore }: Props) {
  if (!bestTime) return null;

  // If the best moment in the window is essentially the current moment,
  // tell the user there's no advantage to waiting. Reads more honestly
  // than always recommending a time.
  const improvement = currentScore - bestTime.score;
  if (improvement <= 5) {
    return (
      <p className="text-[var(--fg)] text-base sm:text-lg leading-snug">
        Right now is about as good as it gets in the next 4 hours.
      </p>
    );
  }

  return (
    <p className="text-[var(--fg)] text-base sm:text-lg leading-snug">
      Try around{" "}
      <span className="display font-normal text-[1.15em]">
        {fmtLocalTime(bestTime.timestamp)}
      </span>{" "}
      <span className="text-[var(--muted)]">for easier parking.</span>
    </p>
  );
}
