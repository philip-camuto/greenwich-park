# Phase 2 trained-model validation — 2026-06-17

## Question

Can a model *trained* on the FOIA citation data replace the Phase 1 demand
surface (`getPrior` + weather modifier) and measurably improve it? Bar agreed
up front: ship the trained model **only if it ties or beats** the existing
heuristic on a held-out year. Otherwise keep the heuristic and make no ML claim.

## Method

`analysis/train_model.py`. Temporal holdout: fit on 2022–2023, test on 2024.
The Phase 1 heuristic is also **refit on 2022–2023 only** so the comparison is
fair (its shipped priors normally see all three years). Both produce a demand
rate per `(dow, hour)` cell, each gets one scaling constant fit on train, and
both are scored on held-out 2024 by Poisson deviance / MAE of predicted vs
actual citation counts, using 2024 officer-day exposure as the offset.

Scope is the **day-of-week × hour** surface inside the enforcement window
(Mon–Sat 8am–4pm) only. Month and weather are deliberately *not* learned from
citations — they are confounded by enforcement behaviour, not demand:

- **December**: the *most* officers per active hour (1.35) but the *fewest*
  citations (967, ~half a normal month) — holiday enforcement grace during peak
  retail demand. A citation-learned December reads near-empty. Wrong.
- **Weather** (`analysis/out/weather_effects.json`, 6,342 hrs): only **rain** is
  a statistically significant effect (rate ratio 0.43, CI [0.35, 0.53]). Snow is
  n=124, CI [0.18, 0.62]; freezing CI [0.68, **1.02**] and warm CI [0.93,
  **1.19**] both cross 1.0 — indistinguishable from no effect. There is no
  reliable weather signal to learn, so weather stays as the additive modifier in
  `heuristic.ts` (an explicit hand estimate, validated only for rain).

## Results (held-out 2024, patrol-adjusted)

| Model | Deviance | MAE |
| --- | --- | --- |
| Saturated Poisson, raw counts | "wins" — but **invalid** | |
| Saturated Poisson, patrol-adjusted | 2662.8 | 60.74 |
| **Smooth Poisson (cubic hour × dow), patrol-adjusted** | **1449.2** | 59.09 |
| **Phase 1 heuristic (fair refit)** | **1437.7** | 53.96 |

Two findings that decided it:

1. **The raw-count GLM's apparent ~10% win was an artifact.** Fitting raw
   citation counts reintroduces the patrol confound the recalibration exists to
   remove: Saturday gets ~half the weekday patrol, so the raw model ranked
   Saturday as the *quietest* day (peak score 62 vs weekday 95). Saturday is the
   busiest day on the Ave. The model only "won" by predicting the confounded
   count surface. Discarded.

2. **Done correctly (patrol-exposure offset), the trained model ties but does
   not beat the heuristic.** The saturated per-cell model overfits noisy cell
   rates (deviance 2663). A regularized smooth version pulls level (1449 vs
   1438) but is still 0.8% worse on deviance and clearly worse on MAE.

## Verdict

**Do not ship a trained model. Make no "machine learning" claim.**

The reason is itself the result worth keeping: the existing recalibrated priors
are already a sound, data-driven, patrol-adjusted statistical demand estimate.
A pure-data model matches them but cannot beat them, because the heuristic's
60/40 blend with hand priors acts as regularization — sensible human knowledge
(e.g. "Saturday is busy") stabilizes the noisy citation cells. The right
architecture here is exactly what is shipped: **citation data + informed
priors**, not a bolted-on GLM.

Net positive from this exercise: the Phase 1 priors now have their **first
out-of-sample validation** (held-out 2024 deviance 1437.7), and
`analysis/train_model.py` is a reproducible harness to re-run the comparison
when richer data (ParkMobile, camera pilot) arrives — at which point a trained
model on *true occupancy* labels, rather than the citation proxy, is the real
Phase 2.
