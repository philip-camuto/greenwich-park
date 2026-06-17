# GBM vs Poisson GLM for the demand surface, decision record (2026-06-17)

**Status: Decided. Keep the shipped Poisson GLM. The GBM is not adopted.**

This is a permanent record of a negative result. It exists so the experiment is
not re-run blind in six months. If you are about to "try a gradient-boosted
model on the parking demand surface," read the "When to revisit" section first:
the answer here is conditional, not eternal.

## Question tested

Does a regularized gradient-boosted Poisson model (LightGBM) of the
day-of-week x hour parking-demand surface beat the shipped Poisson GLM
(`analysis/train_model.py`: `citations ~ C(dow)*(cubic hour)` with a
`log(officer-day exposure)` offset)?

Two exposure variants were tested, both wired as LightGBM `init_score = log(E)`:

- **E1**, the endogenous officer-day offset, identical to the shipped GLM offset
  (distinct `(officer, date)` pairs that wrote at least one ticket in the cell).
- **E2**, a smoothed time-of-week patrol prior: an additive Poisson smoother of
  exposure on `C(dow) + cubic-hour`, so a cell's exposure is the global
  week-shape at that position rather than its own ticket-driven count. (Caveat:
  E2 removes the per-cell endogeneity but is still ticket-derived. A truly
  exogenous patrol exposure needs the patrol-schedule FOIA, which we do not have.)

## Verdict

The GBM does **not** clear both baselines on forward-chaining held-out deviance,
so the GLM stays. The reproducible experiment is committed (see "Artifacts")
because the negative result is itself the asset.

## Evidence: forward-chaining cross-validation

Splits are forward-chaining (train past, test future), **not** the
leave-one-year-out splits in `analysis/out/cv_report.json`. To keep the
comparison apples-to-apples, the GLM and the seasonal-mean baseline were
recomputed under these same forward-chaining folds rather than quoting the LOYO
numbers.

- Fold 1: train `[2022]`, test `2023`
- Fold 2: train `[2022, 2023]`, test `2024`

Every candidate gets exactly one scaling constant per fold (fit on that fold's
training years), turning its demand estimate into a citations-per-officer-day
rate; predicted count = `k * estimate * test exposure`. Identical degrees of
freedom across models. Metric: Poisson deviance (lower is better), plus MAE.

| model           | test 2023 | test 2024 | pooled deviance | pooled MAE |
|-----------------|----------:|----------:|----------------:|-----------:|
| GBM-E1          |   2560.3  |   1587.0  |        4147.3   |     63.80  |
| GBM-E2          |   4449.9  |   4792.5  |        9242.5   |     95.04  |
| **GLM (shipped)** | **2673.2** | **1449.2** |    **4122.4**   |   **66.57** |
| seasonal-mean   |   2541.7  |   2669.7  |        5211.4   |     64.23  |

Read the table honestly, because it does not tell a clean story:

- On **pooled deviance** (the principled metric for Poisson counts) the GLM wins
  by 24.9, a **0.6%** margin over GBM-E1.
- But the models **split by fold**: GBM-E1 actually beats the GLM on the thin
  2023 fold (2560 vs 2673); the GLM wins 2024 (1449 vs 1587).
- And on **pooled MAE** the order flips: GBM-E1 (63.8) edges the GLM (66.57), and
  even the naive seasonal-mean (64.23) beats the GLM on MAE.

The seasonal-mean line is the tell. A model with no day x hour shape at all,
just each cell's own historical rate, is competitive (it beats the GLM on 2023
deviance and on pooled MAE). When the dumbest baseline is in the same band as
the smoothed GLM and the boosted tree, the surface is simple and there is little
structure left for sophistication to extract.

## Why the GBM doesn't win

The demand surface is **~54 in-window cells** (Mon to Sat x 8am to 4pm) over two
to three years. The shipped GLM already spends 24 parameters
(`C(dow)*(cubic hour)`) smoothing that surface into a bell-shaped curve per
weekday. That structure is a strong, well-matched prior: parking demand on a
retail street really is a smooth single-peaked curve by hour, shifting later on
Saturday. A regularized tree, handed the same dow and hour features, has almost
nothing left to find. There is no non-linear interaction in a `(dow, hour)`
grid that a cubic-in-hour crossed with day dummies cannot already represent. So
the tree either rediscovers the same smooth surface (when fit) or shrinks toward
the offset baseline (when regularized, as here). Either way it cannot pull ahead.

**Why E2 fails badly (9242 vs 4122).** The smoothed patrol prior is constant
across years by construction. It cannot track 2024's actual enforcement
exposure, so its predicted counts are mis-scaled against the held-out year. E2
produces a cleaner demand *shape* but a worse count *predictor*, and the metric
here scores count deviance, which rewards tracking real exposure. This is an
expected, explained failure, not a bug. E2's value, if any, is conceptual: it is
what a demand surface looks like when you refuse to let enforcement intensity
leak into it. It is the wrong tool for predicting citation counts.

## Strength of conclusion (stated honestly)

This is **"no evidence that a GBM helps at this data scale,"** not "the GBM is
proven worse." A 0.6% pooled-deviance margin, over 2 forward-chaining folds, on
54 cells, with the metric order flipping between deviance and MAE, is a wash.
The honest claim is that sophistication buys nothing here, not that it is
harmful. A negative result that overclaims ("trees are worse for this problem")
would be exactly as sloppy as a fudged positive that overclaims a win. It is a
tie, and on a tie you keep the simpler, already-shipped, already-validated model.

## Calibration caveat (weakens every row equally)

All four models over-predict on the held-out data (see
`analysis/out/gbm_calibration.png`: every decile sits below the perfect line).
The cause is structural to forward-chaining on three years: Fold 1 trains on a
single year (2022) and over-predicts 2023. This inflates every model's deviance
and MAE by a similar amount, so it does not change the *ranking*, but it does
mean none of these absolute numbers should be read as the model's true
out-of-sample error. It weakens all conclusions equally. With more years the
folds would be less thin and the absolute calibration would improve.

## When to revisit (this is the useful part)

The verdict is "keep the GLM **at this data scale and with these features**."
Two specific changes would make it worth re-running, and one of them is on the
roadmap:

1. **More citation-years.** At 54 cells x 2 to 3 years there is not enough data
   for a tree to justify splits the GLM's cubic does not already make. Several
   more years of FOIA data would give the trees something to chew on, and would
   also fix the fold-1 single-year calibration problem above.

2. **Phase 4: real occupancy labels instead of citations-as-proxy (the real
   trigger).** Today the target is citation counts, a thin proxy where the only
   signal is a smooth day x hour shape, which the GLM nails. When the target
   becomes actual occupancy or sensor data, the GBM's natural edge appears:
   **non-linear interactions the GLM's additive offset and per-weekday cubic
   structurally cannot see**, for example rain x Saturday x December behaving
   differently than the sum of those effects. The GLM bakes in "smooth bell per
   weekday, patrol divided out"; it has no way to represent a three-way
   interaction. A tree does. The moment the feature set grows past `(dow, hour)`
   to include weather, event calendars, and transit as real per-observation
   inputs, re-run this bake-off. That is where the tree could win.

If neither condition holds, do not re-run this. The answer is in the table above.

## Reproduce (macOS Tahoe recipe)

The shared blocker for all Phase 3 modeling work was the macOS Tahoe numpy ABI
break (`ImportError: cannot import name randbits`) in `uv run` ephemeral envs.
A persistent venv with a pinned numpy dodges it:

```sh
cd analysis
uv venv --python 3.13 .venv-gbm
uv pip install --python .venv-gbm/bin/python \
  'numpy==1.26.4' pandas lightgbm scikit-learn statsmodels matplotlib
.venv-gbm/bin/python train_gbm.py \
  "$HOME/Desktop/Parking Citations/citations_normalized.csv"
```

`numpy==1.26.4` is the pin that imports cleanly on this machine. The raw CSV is
not in the repo; it lives at `~/Desktop/Parking Citations/citations_normalized.csv`.
`analysis/.venv-gbm/` is gitignored.

## Artifacts (committed, though the model is not adopted)

- `analysis/train_gbm.py` — the experiment. Imports the data prep verbatim from
  `train_model.py` so the candidates are identical to the shipped GLM; only the
  learner changes.
- `analysis/out/gbm_report.json` — full machine-readable results: correctness
  checks, per-fold and pooled deviance/MAE, LightGBM params, verdict.
- `analysis/out/gbm_calibration.png` — calibration by predicted-count decile,
  all four models.

Offset-wiring correctness was verified before trusting any of the above:
exposure-linearity (`pred(2E) == 2*pred(E)`, so the output is a rate times
exposure, not a raw count) and offset reconciliation on an unregularized fit
(`sum(rate*E) == sum(actual)`, so `log(E)` makes the output a per-officer-day
rate). Both pass; see `gbm_report.json`.

`src/lib/model/trained-coefficients.json` was not touched. No model change ships
from this work.
