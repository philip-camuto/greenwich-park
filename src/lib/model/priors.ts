// Demand priors for the Greenwich Ave shopping district.
//
// Indexed [dayOfWeek 0=Sun..6=Sat][hour 0..23]. Each cell is the baseline
// demand score (0-100) for that hour-of-week, before weather, traffic,
// holiday, or special-event adjustments.
//
// WHERE THIS MATTERS AT RUNTIME (read before editing in-window cells):
//   - OUTSIDE the enforcement window (Sundays, before 8am, after 4pm) this
//     matrix IS the base, at full weight. These are the cells worth tuning.
//   - INSIDE Mon-Sat 8am-4pm the trained surface (model/trained.ts) supplies
//     95% of the base and this matrix only 5% (MODEL_BLEND_ALPHA, CV-tuned).
//     So the in-window cells below move scores by ~1 point at most. The
//     2026-06-11 citation recalibration touched ONLY in-window cells, which
//     means it now reaches users through the trained surface, not through
//     these numbers. The in-window values are kept as the 5% blend anchor and
//     as a record of the citation shape; do not expect editing them to change
//     in-window scores. To move the in-window curve, retrain (analysis/
//     train_model.py) or change MODEL_BLEND_ALPHA.
//
// Calibration sources:
//   1. Hand calibration by a frequent local user (2026-05-12) — still the
//      sole source for Sundays, evenings, and early mornings.
//   2. FOIA parking-citation data: 21,892 citations on Lower/Upper Greenwich
//      Ave, Jan 2022 - Dec 2024 (Greenwich Parking Services, received
//      2026-06-11). Enforcement only runs ~9am-4pm Mon-Sat, so only those 48
//      cells were recalibrated; each is a blend of 60% data / 40% hand prior
//      (30% data in the thinner 8am/4pm shoulder cells). Citation intensity
//      is patrol-adjusted (citations per active officer-hour) so enforcement
//      staffing patterns don't masquerade as demand, and year-normalized so
//      the 2023 staffing dip doesn't drag means down. Derivation:
//      analysis/recalibrate_priors.py -> analysis/out/recalibrated_priors.json.
//
// What the citation data changed:
//   - Weekday 9-11am was underestimated by 20-30 points: late morning is the
//     real weekday meter-pressure peak (errands + salon/spa before lunch),
//     not the 12-1pm lunch window.
//   - Weekday 2-4pm runs slightly cooler than guessed.
//   - Saturday midday stays the weekly maximum but tops out at ~93, not 95,
//     and the peak sits at 1pm rather than a noon-1pm plateau.
//
// Still hand-calibrated (no enforcement = no citation signal):
//   - Sundays (parking is free, zero enforcement; 26 tickets in 3 years).
//   - Evenings after ~4pm, incl. the Thu/Fri dinner bump.
//   - Early mornings before ~8am, late night.
//
// Phase 2 swaps this matrix for the output of a model trained on historical
// observations. Re-tune by editing values and bumping the calibration date
// below; do not introduce conditional logic here.
//
// Last calibrated: 2026-06-11 (citation-data recalibration).

const SUN: number[] = [
  /*  0 */ 5, 5, 5, 5, 5, 5, 8, 12, 25, 45, 65, 78, 85, 85, 78, 65, 55, 50, 45,
  40, 30, 18, 8, 5,
];
const MON: number[] = [
  /*  0 */ 5, 5, 5, 5, 5, 5, 8, 18, 31, 64, 74, 79, 71, 68, 58, 46, 52, 60, 60,
  55, 40, 25, 12, 6,
];
const TUE: number[] = [
  /*  0 */ 5, 5, 5, 5, 5, 5, 8, 18, 31, 54, 71, 76, 68, 66, 67, 53, 50, 60, 60,
  55, 40, 25, 12, 6,
];
const WED: number[] = [
  /*  0 */ 5, 5, 5, 5, 5, 5, 8, 18, 31, 49, 74, 77, 73, 68, 61, 51, 54, 62, 62,
  55, 40, 25, 12, 6,
];
const THU: number[] = [
  /*  0 */ 5, 5, 5, 5, 5, 5, 8, 18, 32, 61, 74, 82, 72, 71, 61, 54, 55, 70, 72,
  65, 50, 32, 18, 8,
];
const FRI: number[] = [
  /*  0 */ 5, 5, 5, 5, 5, 5, 10, 22, 36, 55, 74, 77, 74, 74, 66, 56, 68, 80, 85,
  82, 72, 55, 35, 18,
];
const SAT: number[] = [
  /*  0 */ 12, 8, 5, 5, 5, 5, 10, 20, 35, 63, 77, 88, 86, 93, 82, 80, 75, 78,
  80, 80, 72, 55, 38, 22,
];

export const HOUR_DOW_PRIORS: number[][] = [SUN, MON, TUE, WED, THU, FRI, SAT];

export function getPrior(dayOfWeek: number, hour: number): number {
  const row = HOUR_DOW_PRIORS[dayOfWeek];
  if (!row) return 0;
  return row[hour] ?? 0;
}
