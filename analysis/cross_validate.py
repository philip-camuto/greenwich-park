# Rigorous out-of-sample comparison of the demand-surface candidates.
#
# train_model.py validated on a single split (train 2022-2023, test 2024) and
# found the trained model TIES the heuristic. A single split is one draw of
# luck. This script does the honest version:
#
#   1. Leave-one-year-out CV (3 folds: hold out 2022, then 2023, then 2024;
#      fit on the other two). Every cell-year is predicted out-of-sample
#      exactly once.
#   2. Four candidates scored on each held-out year:
#        - pure-model : trained Poisson rate surface (analysis/train_model.py)
#        - hand-prior : the raw hand-calibrated priors.ts matrix, no data
#        - heuristic  : the shipped 60/40 data+prior blend (recalibrate recipe)
#        - blend(a)   : a * pure-model-score + (1-a) * hand-prior, a tuned by CV
#   3. A grid search over the blend weight a in [0,1] to find the shrinkage that
#      generalizes best -- i.e. how much to trust the citation data vs the prior.
#   4. A bootstrap over cells for a confidence interval on the deviance gap, so
#      "ties" / "beats" is a measured claim with uncertainty, not a point number.
#
# Each candidate gets ONE scaling constant per fold (fit on that fold's training
# years) turning its demand estimate into a citations-per-officer-day rate;
# predicted count = rate * test officer-day exposure; scored by Poisson deviance.
#
# Run:
#   uv run --with pandas --with statsmodels --with numpy \
#     python3 analysis/cross_validate.py "~/Desktop/Parking Citations/citations_normalized.csv"
#
# Output: analysis/out/cv_report.json  (+ printed table). Changes nothing that
# ships; this is analysis only.

import json
import os
import sys

import numpy as np
import pandas as pd

# reuse the committed training code so the candidates are identical to shipped
from train_model import (  # noqa: E402
    ENFORCED_DOWS,
    OLD_PRIORS,
    WINDOW_HOURS,
    cells,
    fit_rate_model,
    heuristic_rate_grid,
    load_citations,
    map_grid_to_scores,
    poisson_deviance,
)

OUT_DIR = os.path.join(os.path.dirname(__file__), "out")
YEARS = [2022, 2023, 2024]
ALPHAS = [round(x / 20, 2) for x in range(21)]  # 0.00 .. 1.00 step 0.05
BOOT = 2000
SEED = 12345


def model_score_grid(rate_grid):
    """Map a trained rate grid onto the 0-100 demand scale (same mapping the
    runtime uses), so it can be blended with the 0-100 hand prior."""
    m = map_grid_to_scores(rate_grid)
    span = m["mu_max"] - m["mu_min"]
    grid = [[None] * 24 for _ in range(7)]
    for d in ENFORCED_DOWS:
        for h in WINDOW_HOURS:
            r = rate_grid[d][h]
            s = m["score_lo"] if span <= 0 else (
                m["score_lo"] + (r - m["mu_min"]) / span * (m["score_hi"] - m["score_lo"])
            )
            grid[d][h] = max(0.0, min(100.0, s))
    return grid


def blend_grid(model_scores, alpha):
    grid = [[None] * 24 for _ in range(7)]
    for d in ENFORCED_DOWS:
        for h in WINDOW_HOURS:
            grid[d][h] = alpha * model_scores[d][h] + (1 - alpha) * OLD_PRIORS[d][h]
    return grid


def cell_estimate(grid, cell_df):
    return cell_df.apply(lambda r: grid[int(r["dow"])][int(r["hour"])], axis=1).to_numpy()


def scaled_pred(train_cells, test_cells, grid):
    """One scaling constant fit on train, applied to test; returns predicted
    counts and the actual test counts (aligned)."""
    tr_est = cell_estimate(grid, train_cells)
    tr_n = train_cells["n"].to_numpy()
    tr_e = train_cells["exposure"].to_numpy()
    k = tr_n.sum() / max((tr_est * tr_e).sum(), 1e-9)
    te_est = cell_estimate(grid, test_cells)
    te_e = test_cells["exposure"].to_numpy()
    return k * te_est * te_e, test_cells["n"].to_numpy()


def main():
    csv_path = os.path.expanduser(
        sys.argv[1] if len(sys.argv) > 1
        else "~/Desktop/Parking Citations/citations_normalized.csv"
    )
    os.makedirs(OUT_DIR, exist_ok=True)
    df = load_citations(csv_path)

    # accumulate out-of-sample predictions across all folds
    oos = {name: {"pred": [], "actual": []} for name in ("model", "prior", "heuristic")}
    oos.update({f"blend@{a}": {"pred": [], "actual": []} for a in ALPHAS})

    for test_year in YEARS:
        train_years = [y for y in YEARS if y != test_year]
        tr = cells(df, train_years)
        te = cells(df, [test_year])

        rate_grid = fit_rate_model(tr)
        m_scores = model_score_grid(rate_grid)
        prior_grid = [row[:] for row in OLD_PRIORS]
        heur_grid = heuristic_rate_grid(df, train_years)

        for name, grid in (
            ("model", rate_grid),
            ("prior", prior_grid),
            ("heuristic", heur_grid),
        ):
            p, a = scaled_pred(tr, te, grid)
            oos[name]["pred"].append(p)
            oos[name]["actual"].append(a)
        for alpha in ALPHAS:
            p, a = scaled_pred(tr, te, blend_grid(m_scores, alpha))
            oos[f"blend@{alpha}"]["pred"].append(p)
            oos[f"blend@{alpha}"]["actual"].append(a)

    # pool folds; every cell-year predicted out-of-sample exactly once
    summary = {}
    for name, d in oos.items():
        pred = np.concatenate(d["pred"])
        actual = np.concatenate(d["actual"])
        summary[name] = {
            "deviance": round(poisson_deviance(actual, pred), 1),
            "mae": round(float(np.mean(np.abs(actual - pred))), 2),
        }

    # best blend by CV deviance
    blend_names = [f"blend@{a}" for a in ALPHAS]
    best_blend = min(blend_names, key=lambda n: summary[n]["deviance"])
    best_alpha = float(best_blend.split("@")[1])

    # bootstrap CI on deviance gap (heuristic - best_blend) and (heuristic - model)
    rng = np.random.default_rng(SEED)

    def boot_gap(name_a, name_b):
        pa, aa = np.concatenate(oos[name_a]["pred"]), np.concatenate(oos[name_a]["actual"])
        pb = np.concatenate(oos[name_b]["pred"])
        n = len(aa)
        gaps = []
        for _ in range(BOOT):
            idx = rng.integers(0, n, n)
            da = poisson_deviance(aa[idx], pa[idx])
            db = poisson_deviance(aa[idx], pb[idx])
            gaps.append(da - db)  # positive => name_b better (lower deviance)
        lo, hi = np.percentile(gaps, [2.5, 97.5])
        return {"mean_gap": round(float(np.mean(gaps)), 1),
                "ci95": [round(float(lo), 1), round(float(hi), 1)],
                "b_better_prob": round(float(np.mean(np.array(gaps) > 0)), 3)}

    report = {
        "method": "leave-one-year-out CV (2022/2023/2024), pooled out-of-sample",
        "candidates": summary,
        "best_blend": {"alpha": best_alpha, **summary[best_blend]},
        "bootstrap": {
            "heuristic_vs_model": boot_gap("heuristic", "model"),
            "heuristic_vs_best_blend": boot_gap("heuristic", best_blend),
        },
        "note": (
            "gap = deviance(A) - deviance(B); positive => B lower deviance (better). "
            "b_better_prob = P(B beats A) over bootstrap resamples of cells."
        ),
    }
    with open(os.path.join(OUT_DIR, "cv_report.json"), "w") as fh:
        json.dump(report, fh, indent=1)

    print("=== Leave-one-year-out CV (pooled OOS) ===")
    for name in ("prior", "model", "heuristic"):
        s = summary[name]
        print(f"  {name:10s} deviance {s['deviance']:>9}   MAE {s['mae']}")
    print(f"  best blend a={best_alpha:<4} deviance {summary[best_blend]['deviance']:>9}   "
          f"MAE {summary[best_blend]['mae']}")
    print("\n  blend curve (deviance by alpha, bar = relative within row):")
    devs = [summary[f"blend@{a}"]["deviance"] for a in ALPHAS]
    lo, hi = min(devs), max(devs)
    for a in ALPHAS:
        dev = summary[f"blend@{a}"]["deviance"]
        width = 0 if hi == lo else int((dev - lo) / (hi - lo) * 40)
        print(f"    a={a:<4} {dev:>8}  {'#' * width}")
    print("\n=== Bootstrap (2000x over cells) ===")
    for k, v in report["bootstrap"].items():
        print(f"  {k}: gap {v['mean_gap']} CI{v['ci95']} P(better)={v['b_better_prob']}")


if __name__ == "__main__":
    main()
