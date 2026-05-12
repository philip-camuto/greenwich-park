// Hardcoded demand priors for the Greenwich Ave shopping district.
//
// Indexed [dayOfWeek 0=Sun..6=Sat][hour 0..23]. Each cell is the baseline
// demand score (0-100) for that hour-of-week, before weather, traffic,
// holiday, or special-event adjustments.
//
// Calibration reasoning:
//   - Greenwich Ave is retail + dining, primary operating window ~10am-9pm.
//   - On-street parking is metered 2hr weekdays + Saturday; free Sundays.
//   - Saturday noon-4pm is the heaviest window (shopping + family lunch).
//   - Sunday peaks at brunch (12-1pm) thanks to free parking + restaurants;
//     drops in the afternoon as stores trickle closed earlier than weekdays.
//   - Weekday lunch 11:30-1:30 is a moderate-high bump driven by the office
//     and salon/spa lunch crowd, not commuter throughput.
//   - Weekday commuter rush hits I-95, not the Ave. Early morning (6-8am)
//     on the Ave is mostly coffee + early gym/fitness — low baseline.
//   - Thu/Fri dinner runs hotter than Mon-Wed (pre-weekend dinner crowd).
//   - Late night (after 10pm) is always low — most retail and many
//     restaurants are closed by 10pm even on weekends.
//
// These numbers are calibrated guesses by a frequent local user, not data.
// Phase 2 swaps this matrix for the output of a model trained on historical
// observations. Re-tune by editing values and bumping the calibration date
// below; do not introduce conditional logic here.
//
// Last calibrated: 2026-05-12.

const SUN: number[] = [
  /*  0 */ 5, 5, 5, 5, 5, 5, 8, 12, 25, 45, 65, 78, 85, 85, 78, 65, 55, 50, 45,
  40, 30, 18, 8, 5,
];
const MON: number[] = [
  /*  0 */ 5, 5, 5, 5, 5, 5, 8, 18, 30, 38, 45, 55, 68, 68, 55, 50, 55, 60, 60,
  55, 40, 25, 12, 6,
];
const TUE: number[] = MON;
const WED: number[] = [
  /*  0 */ 5, 5, 5, 5, 5, 5, 8, 18, 30, 40, 48, 60, 72, 72, 58, 52, 58, 62, 62,
  55, 40, 25, 12, 6,
];
const THU: number[] = [
  /*  0 */ 5, 5, 5, 5, 5, 5, 8, 18, 32, 42, 50, 62, 72, 72, 58, 55, 62, 70, 72,
  65, 50, 32, 18, 8,
];
const FRI: number[] = [
  /*  0 */ 5, 5, 5, 5, 5, 5, 10, 22, 38, 48, 55, 68, 78, 78, 68, 65, 70, 80, 85,
  82, 72, 55, 35, 18,
];
const SAT: number[] = [
  /*  0 */ 12, 8, 5, 5, 5, 5, 10, 20, 35, 55, 75, 88, 95, 95, 92, 88, 82, 78,
  80, 80, 72, 55, 38, 22,
];

export const HOUR_DOW_PRIORS: number[][] = [SUN, MON, TUE, WED, THU, FRI, SAT];

export function getPrior(dayOfWeek: number, hour: number): number {
  const row = HOUR_DOW_PRIORS[dayOfWeek];
  if (!row) return 0;
  return row[hour] ?? 0;
}
