import { BLOCKS } from "@/components/avenue-map-data";
import type { DemandCategory } from "@/lib/model/types";

function categorize(score: number): DemandCategory {
  if (score <= 40) return "green";
  if (score <= 70) return "yellow";
  return "red";
}

export function applyBlockOffset(globalScore: number, offset: number): number {
  return Math.max(0, Math.min(100, Math.round(globalScore + offset)));
}

export type PerBlockScore = {
  score: number;
  category: DemandCategory;
  offset: number;
};

export function perBlockScores(
  globalScore: number,
): Record<string, PerBlockScore> {
  const out: Record<string, PerBlockScore> = {};
  for (const b of BLOCKS) {
    const score = applyBlockOffset(globalScore, b.offset);
    out[b.id] = { score, category: categorize(score), offset: b.offset };
  }
  return out;
}
