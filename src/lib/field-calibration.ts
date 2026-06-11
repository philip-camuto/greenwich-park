import type { DemandCategory } from "@/lib/model/types";

export type FieldRating = 0 | 1 | 2 | 3 | 4 | 5;

export type FieldRatingOption = {
  label: string;
  rating: FieldRating;
  score: number;
  shortLabel: string;
};

export const FIELD_RATING_OPTIONS: FieldRatingOption[] = [
  { rating: 0, score: 10, label: "Empty / tons of spaces", shortLabel: "Empty" },
  { rating: 1, score: 25, label: "Easy / several obvious spaces", shortLabel: "Easy" },
  { rating: 2, score: 40, label: "Fine / found a spot in one pass", shortLabel: "Fine" },
  { rating: 3, score: 60, label: "Annoying / circle or side street", shortLabel: "Annoying" },
  { rating: 4, score: 78, label: "Hard / very few spaces", shortLabel: "Hard" },
  { rating: 5, score: 92, label: "Packed / basically no chance", shortLabel: "Packed" },
];

export function scoreForFieldRating(rating: number): number | null {
  return FIELD_RATING_OPTIONS.find((x) => x.rating === rating)?.score ?? null;
}

export function categoryForScore(score: number): DemandCategory {
  if (score <= 40) return "green";
  if (score <= 70) return "yellow";
  return "red";
}

export function fieldRatingLabel(rating: number): string {
  return FIELD_RATING_OPTIONS.find((x) => x.rating === rating)?.shortLabel ?? "Unknown";
}
