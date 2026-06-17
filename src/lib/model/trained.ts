// Phase 2 trained demand surface.
//
// A Poisson GLM (citations ~ C(dow) * cubic-in-hour, with an officer-day
// exposure offset so the fitted rate is patrol-adjusted demand intensity)
// fit on 21,892 FOIA parking citations, 2022-2024. It supplies the in-window
// (Mon-Sat 8am-4pm) demand base, replacing the hand-blended prior matrix there.
//
// Scope is deliberately the day-of-week x hour shape only. Month and weather
// are NOT learned from citations -- enforcement behaviour confounds them (Dec
// has the most officers but the fewest tickets; only rain is a statistically
// significant weather effect). Out-of-window the runtime keeps the hand priors,
// and weather/traffic/transit/holiday stay as the existing modifiers on top.
//
// See analysis/train_model.py (training + holdout harness) and
// docs/phase2-model-validation.md. Retrain by re-running that script.

import coefficients from "./trained-coefficients.json";

type Mapping = {
  mu_min: number;
  mu_max: number;
  score_lo: number;
  score_hi: number;
};

const BASE_GRID = coefficients.base_grid as (number | null)[][];
const MAPPING = coefficients.mapping as Mapping;
const ENFORCED_DOWS = coefficients.enforced_dows as number[];
const [WINDOW_LO, WINDOW_HI] = coefficients.window_hours as [number, number];

// True when the trained model has signal for this slot: the enforcement window
// (Mon-Sat 8am-4pm) where citations actually observe demand.
export function inTrainedWindow(dayOfWeek: number, hour: number): boolean {
  return (
    ENFORCED_DOWS.includes(dayOfWeek) && hour >= WINDOW_LO && hour <= WINDOW_HI
  );
}

// Weight on the trained surface when blending it with the hand prior inside the
// enforcement window. Leave-one-year-out CV (analysis/out/cv_report.json) picks
// alpha=0.95 as the shrinkage that generalizes best: pooled out-of-sample
// deviance 5259.7 at 0.95 vs 5261.8 for the pure model (1.0) and 5274.1 for the
// 60/40 heuristic. The gap is inside the bootstrap CI, so the practical effect
// is ~1 point in-window; 0.95 is the validated choice, and wiring it in keeps
// the runtime consistent with the CV instead of shipping an unvalidated pure
// model. The remaining 5% rides on getPrior(); see heuristic.ts computeDemand.
export const MODEL_BLEND_ALPHA = 0.95;

// In-window demand base (0-100) from the trained surface, or null when the
// slot is outside the model's valid window (caller falls back to getPrior).
export function trainedBaseScore(
  dayOfWeek: number,
  hour: number,
): number | null {
  if (!inTrainedWindow(dayOfWeek, hour)) return null;
  const rate = BASE_GRID[dayOfWeek]?.[hour];
  if (rate == null) return null;
  const { mu_min, mu_max, score_lo, score_hi } = MAPPING;
  const span = mu_max - mu_min;
  const scaled =
    span <= 0
      ? score_lo
      : score_lo + ((rate - mu_min) / span) * (score_hi - score_lo);
  return Math.max(0, Math.min(100, Math.round(scaled)));
}
