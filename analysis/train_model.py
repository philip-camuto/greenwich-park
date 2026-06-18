# Train the Phase 2 demand model: a patrol-adjusted Poisson model of the
# (day-of-week x hour) parking-demand surface on Greenwich Ave, fit on the FOIA
# parking-citation data (Greenwich Parking Services, 21,892 citations,
# Jan 2022 - Dec 2024).
#
# What this replaces
# ------------------
# Phase 1 scores demand as `getPrior(dow, hour)` -- a 7x24 matrix that blends a
# hand-calibrated prior (60/40) with citation shape. This script fits that
# surface as one model and validates it out-of-sample on a held-out year, so
# the demand curve is a retrainable, validated estimate rather than a
# hand-blended matrix.
#
# Why patrol adjustment is the whole game
# ---------------------------------------
# A citation means a metered block was full and overstayed -- a demand proxy --
# but raw counts are dominated by enforcement staffing, not demand:
#   * Saturdays get ~half the weekday patrol, so raw Saturday counts understate
#     demand badly (an earlier raw-count fit put Saturday BELOW every weekday,
#     which is flatly wrong -- Saturday is the busiest day on the Ave).
#   * 2023 had ~55% the citations of 2022/2024 (a staffing dip, not demand).
# So we model citations per officer-day: a Poisson GLM with the patrol presence
# in each cell as an exposure OFFSET. The fitted rate exp(C(dow)*C(hour)) is
# then citations-per-officer = demand intensity, with staffing divided out.
# This is the same demand proxy recalibrate_priors.py used, fit as a model.
#
# What we deliberately do NOT learn from citations
# ------------------------------------------------
# Month-of-year and weather effects are confounded by enforcement BEHAVIOR, not
# just patrol headcount, and the data won't support them:
#   * December has the MOST officers per active hour (1.35) but the FEWEST
#     citations (967, ~half a normal month) -- holiday enforcement grace during
#     peak retail demand. A citation-learned December would read near-empty.
#   * Weather GLM (analysis/out/weather_effects.json, 6342 hrs): only RAIN is a
#     significant effect (rate ratio 0.43, CI [0.35,0.53]). Snow is n=124 with
#     CI [0.18,0.62]; freezing CI [0.68,1.02] and warm CI [0.93,1.19] both
#     CROSS 1.0 -- statistically indistinguishable from no effect.
# So the model owns only the day x hour shape (where patrol is ~constant within
# the 08:00-16:00 window on a given weekday). Weather/traffic/transit/holiday
# stay as the existing runtime modifiers; weather there is an explicit hand
# estimate, validated only for rain.
#
# Validation
# ----------
# Temporal holdout: fit on 2022+2023, test on 2024. The Phase 1 heuristic is
# ALSO refit on 2022+2023 only, so the comparison is fair. Both produce a
# demand rate per (dow,hour) cell; each gets ONE scaling constant fit on train;
# both are scored on held-out 2024 by Poisson deviance / MAE of predicted vs
# actual citation counts, using 2024 patrol exposure as the offset. The model
# ships ONLY if it ties or beats the heuristic. If it ships, the exported
# coefficients are refit on all three years.
#
# Run:
#   uv run --with pandas --with statsmodels --with numpy \
#     python3 analysis/train_model.py "~/Desktop/Parking Citations/citations_normalized.csv"
#
# Outputs:
#   src/lib/model/trained-coefficients.json   runtime artifact (grid + mapping)
#   analysis/out/model_metrics.json           holdout metrics + verdict

import json
import os
import sys

import numpy as np
import pandas as pd

OUT_DIR = os.path.join(os.path.dirname(__file__), "out")
RUNTIME_ARTIFACT = os.path.join(
    os.path.dirname(__file__), "..", "src", "lib", "model", "trained-coefficients.json"
)

WINDOW_HOURS = list(range(8, 17))  # 8am..4pm inclusive
ENFORCED_DOWS = [1, 2, 3, 4, 5, 6]  # Mon..Sat (0=Sun)

# Hand-calibrated priors (src/lib/model/priors.ts). Used only to define the
# 0-100 score scale the demand rate is mapped onto, and as the 40% anchor in
# the heuristic baseline blend. Indexed [dow][hour], 0=Sunday.
OLD_PRIORS = [
    [5, 5, 5, 5, 5, 5, 8, 12, 25, 45, 65, 78, 85, 85, 78, 65, 55, 50, 45, 40, 30, 18, 8, 5],
    [5, 5, 5, 5, 5, 5, 8, 18, 30, 38, 45, 55, 68, 68, 55, 50, 55, 60, 60, 55, 40, 25, 12, 6],
    [5, 5, 5, 5, 5, 5, 8, 18, 30, 38, 45, 55, 68, 68, 55, 50, 55, 60, 60, 55, 40, 25, 12, 6],
    [5, 5, 5, 5, 5, 5, 8, 18, 30, 40, 48, 60, 72, 72, 58, 52, 58, 62, 62, 55, 40, 25, 12, 6],
    [5, 5, 5, 5, 5, 5, 8, 18, 32, 42, 50, 62, 72, 72, 58, 55, 62, 70, 72, 65, 50, 32, 18, 8],
    [5, 5, 5, 5, 5, 5, 10, 22, 38, 48, 55, 68, 78, 78, 68, 65, 70, 80, 85, 82, 72, 55, 35, 18],
    [12, 8, 5, 5, 5, 5, 10, 20, 35, 55, 75, 88, 95, 95, 92, 88, 82, 78, 80, 80, 72, 55, 38, 22],
]

# Closure-grade holidays with ~zero enforcement; excluded so they don't drag
# cell means (the app handles holidays via holidayMod). Also excludes
# Black Friday (normal enforcement + a once-a-year retail spike that would
# inflate the late-Nov Friday baseline, plus the runtime adds its own
# holidayMod spike that day = double-count) and Dec 24 / Dec 31 (grace-
# enforcement days that deflate those cells).
US_HOLIDAYS = {
    "2022-01-01", "2022-01-17", "2022-02-21", "2022-05-30", "2022-06-20",
    "2022-07-04", "2022-09-05", "2022-10-10", "2022-11-11", "2022-11-24",
    "2022-11-25", "2022-12-24", "2022-12-25", "2022-12-26", "2022-12-31",
    "2023-01-01", "2023-01-02", "2023-01-16", "2023-02-20", "2023-05-29",
    "2023-06-19", "2023-07-04", "2023-09-04", "2023-10-09", "2023-11-10",
    "2023-11-23", "2023-11-24", "2023-12-24", "2023-12-25", "2023-12-31",
    "2024-01-01", "2024-01-15", "2024-02-19", "2024-05-27", "2024-06-19",
    "2024-07-04", "2024-09-02", "2024-10-14", "2024-11-11", "2024-11-28",
    "2024-11-29", "2024-12-24", "2024-12-25", "2024-12-31",
}


def load_citations(csv_path):
    df = pd.read_csv(csv_path, parse_dates=["issued_at"])
    df["d"] = df["issued_at"].dt.date.astype(str)
    df = df[~df["d"].isin(US_HOLIDAYS)].copy()
    df["dow"] = (df["issued_at"].dt.dayofweek + 1) % 7  # pandas Mon=0 -> app Sun=0
    df["hour"] = df["issued_at"].dt.hour
    df["year"] = df["issued_at"].dt.year
    df = df[df["dow"].isin(ENFORCED_DOWS) & df["hour"].isin(WINDOW_HOURS)]
    return df


def cells(df, years):
    """Per (dow, hour) cell over `years`: citation count N and patrol exposure E.

    E = distinct (officer, date) pairs that wrote >=1 ticket in the cell =
    officer-days of patrol presence. The Poisson offset log(E) turns the fitted
    rate into citations-per-officer-day = patrol-adjusted demand intensity.

    CAVEAT (endogenous offset): E is observed only when a ticket was written, so
    a patrolled-but-quiet hour reads as zero exposure AND zero count. The rate
    N/E is therefore conditioned on "ticketing happened," which compresses the
    low-demand cells and the window edges (8am/4pm). A clean fix needs real
    patrol schedules (a separate FOIA), not the citation feed. Documented in
    docs/citations-recalibration.md "Known limits".
    """
    sub = df[df["year"].isin(years)]
    rows = []
    for d in ENFORCED_DOWS:
        for h in WINDOW_HOURS:
            cell = sub[(sub["dow"] == d) & (sub["hour"] == h)]
            n = len(cell)
            e = cell.drop_duplicates(["officer", "d"]).shape[0]
            rows.append({"dow": d, "hour": h, "n": n, "exposure": max(e, 1)})
    return pd.DataFrame(rows)


def _poly(frame):
    """Centered cubic hour terms (smooths the demand curve across adjacent
    hours instead of fitting each cell independently)."""
    hc = frame["hour"].astype(float) - 12.0
    out = frame.copy()
    out["hc"], out["hc2"], out["hc3"] = hc, hc ** 2, hc ** 3
    return out


def fit_rate_model(train_cells):
    """Poisson GLM: N ~ C(dow) * (cubic in hour) with offset log(exposure).

    The cubic-in-hour gives each weekday its own smooth bell-shaped demand
    curve (Saturday can peak later than weekdays) while sharing strength across
    adjacent hours -- 24 parameters vs the 54 of a saturated cell model, so it
    regularizes the noisy per-cell rates that made the saturated fit overfit.
    The log(officer-day exposure) offset makes the fitted rate demand intensity
    (citations per officer-day), with patrol/staffing divided out. Returns a
    7x24 grid of fitted rates.
    """
    import statsmodels.api as sm
    import statsmodels.formula.api as smf

    tc = _poly(train_cells)
    m = smf.glm(
        "n ~ C(dow) * (hc + hc2 + hc3)",
        data=tc,
        family=sm.families.Poisson(),
        offset=np.log(tc["exposure"]),
    ).fit()
    grid = [[None] * 24 for _ in range(7)]
    pp = _poly(pd.DataFrame(
        [{"dow": d, "hour": h} for d in ENFORCED_DOWS for h in WINDOW_HOURS]
    ))
    pp["rate"] = m.predict(pp, offset=np.zeros(len(pp)))
    for _, r in pp.iterrows():
        grid[int(r["dow"])][int(r["hour"])] = float(r["rate"])
    return grid


def heuristic_rate_grid(df, years):
    """Phase 1 heuristic demand surface, refit on `years` only (fair baseline).

    Mirrors recalibrate_priors.py: patrol-adjusted citation intensity, year-
    normalized, max-normalized, affine-mapped onto the old priors' in-window
    range, blended 60% data / 40% hand prior (30% in the 8/16 shoulder cells).
    Returns a 7x24 grid of demand SCORES (0-100), not rates.
    """
    sub = df[df["year"].isin(years)]
    # patrol-adjusted, year-normalized intensity per cell
    counts = sub.groupby(["year", "dow", "hour"]).size()
    patrol = sub.groupby(["year", "dow", "hour"]).apply(
        lambda g: g.drop_duplicates(["officer", "d"]).shape[0], include_groups=False
    )
    year_totals = sub.groupby("year").size()
    pooled = year_totals.mean()
    adj = [[0.0] * 24 for _ in range(7)]
    for d in ENFORCED_DOWS:
        for h in WINDOW_HOURS:
            vals = []
            for y in years:
                if y not in year_totals.index:
                    continue
                c = counts.get((y, d, h), 0) * (pooled / year_totals[y])
                p = patrol.get((y, d, h), 0)
                vals.append((c / p) if p else 0.0)
            adj[d][h] = sum(vals) / len(vals) if vals else 0.0

    mx = max(v for row in adj for v in row) or 1.0
    shape = [[v / mx for v in row] for row in adj]
    win = [(d, h) for d in ENFORCED_DOWS for h in WINDOW_HOURS]
    old_in = [OLD_PRIORS[d][h] for d, h in win]
    lo, hi = min(old_in), max(old_in)
    s_in = [shape[d][h] for d, h in win]
    smin, smax = min(s_in), max(s_in)

    def to_scale(v):
        return lo if smax == smin else lo + (v - smin) / (smax - smin) * (hi - lo)

    grid = [row[:] for row in OLD_PRIORS]
    core = set(range(9, 16))
    for d, h in win:
        w = 0.6 if h in core else 0.3
        grid[d][h] = max(0, min(100, w * to_scale(shape[d][h]) + (1 - w) * OLD_PRIORS[d][h]))
    return grid


def poisson_deviance(y, mu):
    y = np.asarray(y, dtype=float)
    mu = np.clip(np.asarray(mu, dtype=float), 1e-9, None)
    pos = y > 0
    term = np.zeros_like(y)
    term[pos] = y[pos] * np.log(y[pos] / mu[pos])
    return float(2.0 * np.sum(term - (y - mu)))


# Score the p95 in-window rate reads as. Anchors the top of the 0-100 demand
# scale to the busy-but-not-freak cell (red zone), matching the old prior peak
# (95) so green/yellow/red banding is preserved. A rate above the p95 clamps
# toward 100 at runtime instead of letting one noisy peak cell rescale the
# whole surface.
SCORE_HI = 95.0


def map_grid_to_scores(rate_grid):
    """Affine-map the demand-rate grid onto a 0-100 demand scale, anchored so
    rate 0 -> score 0 and the p95 in-window rate -> SCORE_HI.

    Two deliberate choices (TODO T1):
      * floor at rate 0 -> 0 (not the old prior's min of 30), so a genuinely
        dead in-window hour (Mon 8am, Sat 4pm) can read honestly empty instead
        of flooring at ~30.
      * top anchored to the p95 quantile of in-window cell rates, NOT the max,
        so one noisy peak cell can't rescale all 54 in-window scores. The rare
        cell above p95 clamps toward 100 (the runtime clamps to [0,100]).

    Emitted as the same {mu_min, mu_max, score_lo, score_hi} affine the runtime
    already applies: score = score_lo + (rate - mu_min)/(mu_max - mu_min) *
    (score_hi - score_lo). With mu_min=0 and score_lo=0 this is
    rate / p95_rate * SCORE_HI.
    """
    win = [(d, h) for d in ENFORCED_DOWS for h in WINDOW_HOURS]
    rates = [rate_grid[d][h] for d, h in win]
    p95 = float(np.percentile(rates, 95))
    # guard the degenerate flat-surface case
    p95 = p95 if p95 > 0 else (max(rates) or 1.0)
    return {"mu_min": 0.0, "mu_max": p95, "score_lo": 0.0, "score_hi": SCORE_HI}


def main():
    csv_path = os.path.expanduser(
        sys.argv[1] if len(sys.argv) > 1
        else "~/Desktop/Parking Citations/citations_normalized.csv"
    )
    os.makedirs(OUT_DIR, exist_ok=True)

    df = load_citations(csv_path)
    print(f"in-window citations: {len(df)}")

    train_years, test_years = [2022, 2023], [2024]
    train_cells = cells(df, train_years)
    test_cells = cells(df, test_years)

    # --- Model: patrol-adjusted Poisson rate, fit on train ---
    rate_grid = fit_rate_model(train_cells)
    model_rate = test_cells.apply(lambda r: rate_grid[int(r["dow"])][int(r["hour"])], axis=1).to_numpy()

    # --- Baseline: heuristic demand scores, refit on train (fair) ---
    heur_grid = heuristic_rate_grid(df, train_years)
    heur_score = test_cells.apply(lambda r: heur_grid[int(r["dow"])][int(r["hour"])], axis=1).to_numpy()

    # Each model gets ONE scaling constant (fit on train) to turn its demand
    # estimate into a citations-per-officer-day rate, then predicted test count
    # = rate * test_exposure. Fair: identical degrees of freedom.
    tr_model = train_cells.apply(lambda r: rate_grid[int(r["dow"])][int(r["hour"])], axis=1).to_numpy()
    tr_heur = train_cells.apply(lambda r: heur_grid[int(r["dow"])][int(r["hour"])], axis=1).to_numpy()
    tr_n, tr_e = train_cells["n"].to_numpy(), train_cells["exposure"].to_numpy()
    k_model = tr_n.sum() / (tr_model * tr_e).sum()
    k_heur = tr_n.sum() / (tr_heur * tr_e).sum()

    te_n, te_e = test_cells["n"].to_numpy(), test_cells["exposure"].to_numpy()
    pred_model = k_model * model_rate * te_e
    pred_heur = k_heur * heur_score * te_e

    metrics = {
        "holdout": "train 2022-2023, test 2024",
        "test_cells": int(len(test_cells)),
        "space": "patrol-adjusted: predicted count = rate * officer-day exposure",
        "model": {
            "deviance": round(poisson_deviance(te_n, pred_model), 1),
            "mae": round(float(np.mean(np.abs(te_n - pred_model))), 2),
        },
        "heuristic_fair": {
            "deviance": round(poisson_deviance(te_n, pred_heur), 1),
            "mae": round(float(np.mean(np.abs(te_n - pred_heur))), 2),
        },
    }
    dev_m, dev_h = metrics["model"]["deviance"], metrics["heuristic_fair"]["deviance"]
    ties_or_beats = dev_m <= dev_h * 1.005
    metrics["verdict"] = {
        "model_ties_or_beats_heuristic": bool(ties_or_beats),
        "deviance_ratio_model_over_heuristic": round(dev_m / dev_h, 4),
    }

    print("\n=== Held-out 2024 (patrol-adjusted intensity) ===")
    print(f"  trained model   deviance {dev_m:>10}   MAE {metrics['model']['mae']}")
    print(f"  heuristic(fair) deviance {dev_h:>10}   MAE {metrics['heuristic_fair']['mae']}")
    print(f"  verdict: model {'TIES/BEATS' if ties_or_beats else 'LOSES TO'} heuristic "
          f"(ratio {metrics['verdict']['deviance_ratio_model_over_heuristic']})")

    with open(os.path.join(OUT_DIR, "model_metrics.json"), "w") as fh:
        json.dump(metrics, fh, indent=1)

    if not ties_or_beats:
        print("\nNOTE: model does NOT beat the heuristic out-of-sample "
              f"(ratio {metrics['verdict']['deviance_ratio_model_over_heuristic']}). "
              "Exporting anyway by owner decision; the honest verdict is recorded "
              "in model_metrics.json and the artifact's validation block.")

    print("\nRefitting on 2022-2024 for the shipped artifact...")
    final_grid = fit_rate_model(cells(df, [2022, 2023, 2024]))
    mapping = map_grid_to_scores(final_grid)

    # sanity: report the resulting scores so a wrong-shaped surface is obvious
    def score(rate):
        s = mapping["score_lo"] + (rate - mapping["mu_min"]) / (
            mapping["mu_max"] - mapping["mu_min"]
        ) * (mapping["score_hi"] - mapping["score_lo"])
        return round(max(0, min(100, s)))

    days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
    print("      " + " ".join(f"{h:>3}" for h in WINDOW_HOURS))
    for d in ENFORCED_DOWS:
        print(days[d] + "  " + " ".join(f"{score(final_grid[d][h]):>3}" for h in WINDOW_HOURS))

    artifact = {
        "model": "poisson-glm-offset",
        "trained_on": "FOIA citations 2022-2024 (Greenwich Parking Services, 21,892 tickets)",
        "scope": "day-of-week x hour demand shape, enforcement window only",
        "method": "Poisson GLM, citations ~ C(dow)*C(hour) with log(officer-day exposure) offset",
        "window_hours": [WINDOW_HOURS[0], WINDOW_HOURS[-1]],
        "enforced_dows": ENFORCED_DOWS,
        "base_grid": final_grid,
        "mapping": mapping,
        "excluded_signals": (
            "Month and weather are NOT learned from citations: enforcement "
            "behavior confounds them (Dec = most officers, fewest tickets, peak "
            "demand; only rain is a statistically significant weather effect). "
            "Weather stays as the additive modifier in heuristic.ts."
        ),
        "note": (
            "Valid inside the enforcement window only (Mon-Sat 8am-4pm). "
            "score = score_lo + (rate - mu_min)/(mu_max - mu_min) * (score_hi - score_lo), "
            "rate = base_grid[dow][hour]. Out-of-window the runtime keeps hand priors."
        ),
        "validation": metrics,
    }
    with open(RUNTIME_ARTIFACT, "w") as fh:
        json.dump(artifact, fh, indent=1)
    print(f"\nwrote {os.path.relpath(RUNTIME_ARTIFACT)}")


if __name__ == "__main__":
    main()
