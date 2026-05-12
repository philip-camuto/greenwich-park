import type { DemandCategory } from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

const FALLBACK_COPY = "Won't get much easier in the next 4 hours.";

export function verdictFor(category: DemandCategory): string {
  switch (category) {
    case "green":
      return "Plenty of spots";
    case "yellow":
      return "Moderately busy";
    case "red":
      return "Tough today";
  }
}

export function formatGreenwichTime(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export type ActionCopyInput = {
  currentScore: number;
  bestTime: { timestamp: string; score: number } | null;
};

export function actionCopyFor({ currentScore, bestTime }: ActionCopyInput): string {
  if (!bestTime) return FALLBACK_COPY;
  const gap = currentScore - bestTime.score;
  const at = formatGreenwichTime(bestTime.timestamp);
  if (gap > 20) return `Easier around ${at}.`;
  if (gap > 5) return `Should ease up by ${at}.`;
  return FALLBACK_COPY;
}
