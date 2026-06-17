# TODOS

Deferred work, with enough context to pick up cold.

## Modeling — surfaced by the 2026-06-17 Phase 3 eng review (outside-voice findings)

**Shared blocker:** all three need a retrain (re-run `analysis/train_model.py` to
regenerate `src/lib/model/trained-coefficients.json`) plus a CV revalidation
(`analysis/cross_validate.py`). Both are currently blocked by the macOS Tahoe
numpy ABI break (`ImportError: cannot import name randbits`) in `uv run`
ephemeral envs. Fix the Python env first (a real venv with a pinned, working
numpy, e.g. `python3.13 -m venv` + `pip install 'numpy==1.26.4' pandas
statsmodels`), then these become straightforward. The raw CSV lives at
`~/Desktop/Parking Citations/citations_normalized.csv` (not in the repo).

### T1 — Trained surface has a structural score floor of 30 (and a single-cell ceiling)

- **What:** `map_grid_to_scores` (`train_model.py`) pins the rate→score affine
  map to the OLD prior's in-window range: `score_lo = min(OLD_PRIORS in-window) =
  30`, `score_hi = max(...) = 95`. So every in-window trained score is ≥30 by
  construction, and the top of the scale is set by a single max-rate cell
  (Sat 11am). The surface inherits the hand prior's floor and peak, not the
  data's own range.
- **Why:** a genuinely dead in-window hour (Mon 8am, Sat 4pm) can never read
  truly empty — it floors at ~30 (yellow-ish green), which overstates demand at
  the quiet edges. And one noisy peak cell rescales all 54 in-window scores.
- **Pros:** quiet hours read honestly low; the scale stops depending on a single
  argmax cell; the trained surface reflects the data, not the prior it replaced.
- **Cons:** changes every in-window score (shifts the whole curve down at the
  bottom), so it needs new test baselines and a product gut-check on whether
  Mon 8am "should" read ~5 like the old prior or somewhere between.
- **Context:** confirmed live — `trained-coefficients.json` mapping is
  `{mu_min, mu_max, score_lo:30, score_hi:95}`; `trained.ts` clamps to [0,100]
  but the affine never produces <30 in-window. Fix: map rate 0→score 0 (or fit
  `score_lo` from the data's own near-zero rate), and anchor `score_hi` to a high
  quantile (p95 of in-window rates), not the max.
- **Depends on / blocked by:** Python env fix (shared blocker above) + retrain.

### T2 — Black Friday (and Dec 24 / Dec 31) not excluded from training

- **What:** `US_HOLIDAYS` in `train_model.py` / `recalibrate_priors.py` excludes
  Thanksgiving but not Black Friday (2022-11-25, 2023-11-24, 2024-11-29), and
  omits Christmas Eve / New Year's Eve.
- **Why:** Black Friday has normal enforcement plus a retail spike, so it trains
  an inflated demand into the late-November Friday baseline — and the runtime
  *also* adds `holidayMod` retail-spike on that day, a mild double-count.
  Dec 24/31 are grace-enforcement days that deflate those cells.
- **Pros:** the Friday baseline curve stops carrying a once-a-year spike;
  removes the Black Friday double-count.
- **Cons:** tiny effect (3 days out of ~150 Fridays in training, smoothed by the
  cubic), so low payoff; needs a retrain to land.
- **Context:** runtime already handles these days via `holidayKind`; the issue
  is only that training doesn't exclude them. Add the dates to `US_HOLIDAYS` in
  both scripts and retrain.
- **Depends on / blocked by:** Python env fix + retrain.

### T3 — (documented, not a code change) Weather GLM standard errors

- **What:** the weather GLM uses HC1 SEs (treats 6,342 hourly obs as
  independent) with no clustering on date and no multiplicity control over the
  4 weather terms.
- **Status:** **documented** in `docs/citations-recalibration.md` ("Caveat on
  the weather statistics"). No code change planned — the weather modifiers were
  validated, not changed, so stakes are low. Listed here only so it isn't
  rediscovered as new. If ever revisited, cluster SEs on date.

## Environment / security

### T4 — Secret-scanning hook prints tokens in cleartext during `uv run`

- **What:** during `uv run` (observed 2026-06-17), a local hook printed a
  "SECRET PATTERN HITS" report to stdout containing real token values (a GitHub
  token, a `cfut_` token, a CT API key) plus Obsidian-vault keywords. It scans
  what looks like a session transcript (~2000+ lines).
- **Why it matters:** secrets land in plaintext logs / captured output. Local
  only (not exfiltrating), but it's a leak surface.
- **Context:** not part of this repo — it's a machine-level hook. Find what emits
  it (shell init, a uv plugin, or a Claude Code hook) and stop it printing values.
- **Depends on / blocked by:** nothing; independent of the modeling work.
