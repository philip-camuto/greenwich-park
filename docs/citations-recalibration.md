# Prior recalibration from FOIA citation data — 2026-06-11

## The data

Greenwich Parking Services answered a CT FOIA request (filed 2026-05-12) with
seven spreadsheets: every citation issued on Lower Greenwich Ave, Upper
Greenwich Ave, plus handwritten tickets ("GREENWICH AVENUE"), January 2022
through December 2024.

- **21,892 citations** after normalization (header-keyed parsing per file —
  column layouts drift between exports; 6 rows with corrupt dates dropped;
  zero duplicate citation numbers).
- Fields: citation number, issue timestamp (to the second), officer nickname,
  zone, zone name, violation type, base amount, location.
- ~94% are meter violations — i.e. "this block was at capacity and someone
  overstayed," exactly the demand proxy the app wants.
- Normalized CSV lives at `~/Desktop/Parking Citations/citations_normalized.csv`
  and in the `citations_raw` table (import: `analysis/import_citations.ts`).

## Why raw counts lie, and the two corrections

**Patrol confound.** No officer on the Ave means no tickets regardless of
demand. Enforcement runs ~9am–4pm Mon–Sat only (Sunday parking is free:
26 tickets in 3 years), and Saturdays get roughly **half** the weekday patrol.
Correction: patrol presence per (day, hour) cell is estimated as distinct
(officer, date) pairs writing ≥1 ticket in that cell; the demand proxy is
**citations per officer-hour**, not raw counts. Caveat: officer ID `999` is a
shared/system ID (~35% of tickets, flat 33–40% across days), so patrol is
undercounted uniformly — fine for relative shape.

**Staffing drift across years.** 2023 has ~55% the citations of 2022/2024 —
enforcement staffing, not demand. Each year is scaled to a common mean before
pooling, so only the *shape* of each year contributes.

Holiday closure days (zero enforcement) are excluded so they don't drag down
cell means; the app already handles holidays via `holidayMod`.

## What changed in `HOUR_DOW_PRIORS`

Method: max-normalized patrol-adjusted intensity, affine-mapped onto the old
priors' own range within the enforcement window, then blended **60% data /
40% hand prior** in core cells (9am–3pm Mon–Sat) and 30% data in the thinner
8am/4pm shoulders. Cells outside the window (Sundays, evenings, nights) keep
the 2026-05-12 hand calibration — no enforcement means no evidence either way.

48 of 168 cells changed. The story in three lines:

1. **Weekday late morning was underestimated by 20–30 points.** 10–11am is
   the real weekday meter-pressure peak (Mon 11am: 55 → 79; Thu 11am: 62 → 82),
   not the 12–1pm lunch window the hand priors assumed.
2. **Weekday mid-afternoon runs slightly cooler than guessed** (2–4pm cells
   down ~3–9 points).
3. **Saturday midday holds as the weekly maximum but tops at 93, not 95**,
   peaking at 1pm rather than a noon plateau. (Early blends that mixed raw
   counts back in dragged Saturday to ~79 — an artifact of Saturday's thinner
   patrol, which is exactly why the patrol adjustment exists.)

Full per-cell provenance: `analysis/out/recalibrated_priors.json`.

## Weather modifiers: validated, not changed

A Poisson GLM over 6,342 enforcement-window hours (hourly citation counts ~
day + hour + month + weather, hourly weather from the Open-Meteo archive for
41.0262, −73.6282):

| Condition | Raw rate ratio | After patrol control | Heuristic says | Verdict |
| --- | --- | --- | --- | --- |
| Rain | 0.43 [0.35, 0.53] | ~0.72 (officers patrol 44% less in rain) | −20 | **Keep.** 0.72× of a ~65 prior ≈ −18. |
| Snow | 0.33 [0.18, 0.62] | n/a (124 hrs, too thin to control) | −40 | **Keep.** Consistent. |
| Freezing | 0.83 [0.68, 1.02] | — | −10 | **Keep.** ≈ −10 at typical priors. |
| Warm & dry | 1.05 [0.93, 1.19] | — | +5/+10 | **Keep.** Slightly generous, harmless. |

The headline lesson: the naive regression said rain should be −35 and it
would have been wrong — officers ticket less in rain partly because they
patrol less in rain. Control for patrol and the existing hand-tuned −20 is
almost exactly right.

**Caveat on the weather statistics.** The GLM uses HC1 (heteroskedasticity-
robust) standard errors, which treat the 6,342 hourly observations as
independent. Citations within a day and block are serially correlated, so the
true confidence intervals are wider than reported — clustering on date would be
more honest. Four weather terms were tested with no multiplicity control, and
the freezing/warm thresholds (≤32°F, ≥65°F) are hand-chosen cutpoints. Read
"only rain is significant" as directional, not a hardened result. It only
validates the existing hand modifiers (which were not changed), so the stakes
are low — but don't quote the CIs as if they were cluster-robust.

## Reproducing

```bash
uv run --with pandas --with statsmodels --with requests \
  python3 analysis/recalibrate_priors.py "$HOME/Desktop/Parking Citations/citations_normalized.csv"
```

Outputs land in `analysis/out/`. Weather is cached at
`analysis/data/weather_2022_2024.json` (gitignored, refetched on demand).

## What this recalibration actually drives at runtime

Honest accounting: this recalibration changed only the in-window cells
(Mon-Sat 8am-4pm). The Phase 2 trained surface (`src/lib/model/trained.ts`),
which shipped after, supplies the in-window base, blended 95% trained / 5%
prior (`MODEL_BLEND_ALPHA`, tuned by leave-one-year-out CV in
`analysis/out/cv_report.json`). At 5% weight the recalibrated in-window values
move scores by ~1 point at most, so the per-cell changes above (Mon 11am
55 -> 79, etc.) are now carried to users by the trained surface, not by
`priors.ts`. The recalibration is preserved as the 5% blend anchor and as a
record of the citation shape; it is load-bearing in `priors.ts` only OUTSIDE
the enforcement window, where it changed nothing. To move the in-window curve,
retrain or change the blend weight, not the prior cells.

## Known limits

- Citation timestamps lag arrival by up to the meter period (~2h), so the
  intra-day shape is demand smeared rightward by up to an hour or two.
- The signal is blind after 4pm and on Sundays; those cells remain opinion.
- **Endogenous patrol exposure.** Patrol presence is measured as distinct
  (officer, date) pairs that *wrote at least one ticket* in a cell. An officer
  who patrolled a quiet block and wrote nothing contributes zero exposure and
  zero count, so the rate (citations per officer-day) is conditioned on
  "ticketing happened." That compresses the low-demand cells and the window
  edges (8am, 4pm), where the data is also thinnest. A clean fix needs real
  patrol schedules (a separate FOIA), not the citation feed. Same construct is
  the Poisson offset in `analysis/train_model.py`, so the trained surface
  carries the same bias.
- **Overlapping staffing corrections (recalibrate path only).** Cell means are
  both year-normalized (scaled to a common annual mean) and divided by per-cell
  patrol presence. Both correct for staffing and overlap for the 2023 dip, so
  the recalibrate-path intensities may be mildly over-corrected. The shipped
  trained surface uses the cleaner offset form (`train_model.py`) and does not
  double-correct; this caveat applies to the `recalibrate_priors.py` output,
  which is the 5%-weighted anchor in-window.
- One export, ending Dec 2024. If a quarterly refresh gets negotiated,
  re-run the import (idempotent) and the recalibration, and bump the
  calibration date in `priors.ts`.
