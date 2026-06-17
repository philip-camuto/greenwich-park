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

### T5 — RESOLVED 2026-06-17: GBM challenger evaluated, GLM retained

- **What:** tested whether a regularized gradient-boosted Poisson model
  (LightGBM, two exposure variants E1/E2) beats the shipped Poisson GLM on the
  day x hour demand surface. Forward-chaining CV against the GLM and a
  seasonal-mean baseline.
- **Verdict:** **keep the GLM.** GBM does not clear both baselines; pooled
  deviance 4147 (GBM-E1) vs 4122 (GLM), a 0.6% margin that flips to the GBM on
  MAE. A wash at this data scale (~54 cells, 2-3 years), not a GBM loss.
- **Decision record:** `docs/gbm-vs-glm-decision.md` (ADR, with the full CV
  table, why trees can't beat a 24-param cubic GLM on this surface, the honest
  strength-of-conclusion, and the revisit conditions: more citation-years, and
  especially the Phase-4 swap to real occupancy labels where non-linear
  weather/event interactions would give a tree something the GLM's offset can't
  see).
- **Artifacts (committed, not adopted):** `analysis/train_gbm.py`,
  `analysis/out/gbm_report.json`, `analysis/out/gbm_calibration.png`.
- **Not a blocker.** Closed with reason; do not re-run blind. Re-open only if a
  revisit condition in the decision doc is met.

## Environment / security

### T4 — RESOLVED 2026-06-17: cleartext token leak (was NOT a hook)

- **What it actually was:** stale `/tmp` scratch scripts — `/tmp/secrets.py`
  plus 4 siblings (`analyze.py`, `scope.py`, `verify.py`, `final.py`) — left by
  a prior session's secret-audit subagent. `secrets.py` opened a session
  transcript JSONL and `print()`d every match including literal token values.
  It was never a Claude/shell hook: the only configured hook
  (`~/.local/bin/vault-deletion-check.sh`, SessionStart) does no scanning and is
  innocent. Ruled out plugins, sitecustomize/usercustomize, launchd/cron, and
  command-type triggers via 20+ controlled probes.
- **Fix applied:** shredded the 5 `/tmp` scripts; verified nothing on disk can
  print the banner; benign `python3` from `/tmp` now emits no tokens.
- **Remediation (tracked outside this repo):** GitHub + Cloudflare tokens being
  rotated (they were printed to stdout); CT key left (free, rate-limited).
  Token values redacted from inactive transcripts via
  `~/.local/bin/scrub-transcript-secrets.sh`; active session scrubbed post-session.
- **Residual action:** none in this repo. Closed.
