# Recalibrate the hour-of-week prior matrix in src/lib/model/priors.ts against
# FOIA parking-citation data (Greenwich Parking Services, received 2026-06-11).
#
# Method
# ------
# Citations are issued where meters are full and overstayed, so citation
# intensity per hour is a demand proxy — but it is confounded by patrol
# staffing (no officer on the Ave, no tickets, regardless of demand). Two
# corrections:
#   1. Patrol adjustment: for each (dayOfWeek, hour) cell, patrol presence is
#      estimated as distinct (officer, date) pairs that wrote >=1 ticket in
#      that cell. Demand proxy = citations per officer-hour, not raw counts.
#      Caveat: officer ID 999 is a shared/system ID covering ~35% of tickets,
#      so patrol presence is undercounted in cells where 999 dominates; the
#      adjusted and raw shapes are both reported and blended conservatively.
#   2. Year normalization: 2023 has ~55% of the citations of 2022/2024
#      (staffing, not demand), so each year's cells are scaled to a common
#      mean before pooling.
#
# Enforcement only runs ~09:00-16:00 Mon-Sat. Outside that window the
# citation signal is silence, not evidence of low demand, so the existing
# hand-calibrated priors are kept as-is there. Inside the window the new
# prior is a blend: 60% data, 40% existing prior, with the data mapped onto
# the prior's own scale within the window (the citations give relative shape,
# not an absolute 0-100 demand level).
#
# Weather: hourly weather 2022-2024 from the Open-Meteo archive API is joined
# to hourly citation counts and a Poisson GLM estimates how much rain/snow
# actually depress observed demand, as a sanity check on the heuristic's
# weather modifiers (rain -20, snow -40 on a 0-100 scale).
#
# Run:
#   uv run --with pandas --with statsmodels --with requests \
#     python3 analysis/recalibrate_priors.py "~/Desktop/Parking Citations/citations_normalized.csv"
#
# Outputs (analysis/out/):
#   intensity_matrices.json   raw + patrol-adjusted citations per (dow, hour)
#   weather_effects.json      Poisson rate ratios for weather conditions
#   recalibrated_priors.json  proposed 7x24 matrix + per-cell provenance

import json
import math
import os
import sys
from collections import defaultdict
from datetime import date, datetime

import pandas as pd
import requests

OUT_DIR = os.path.join(os.path.dirname(__file__), "out")
WEATHER_CACHE = os.path.join(os.path.dirname(__file__), "data", "weather_2022_2024.json")
LAT, LON = 41.0262, -73.6282  # Greenwich Ave, Greenwich CT

# Existing hand-calibrated priors (src/lib/model/priors.ts, 2026-05-12).
# Indexed [dayOfWeek][hour], 0=Sunday.
OLD_PRIORS = [
    [5, 5, 5, 5, 5, 5, 8, 12, 25, 45, 65, 78, 85, 85, 78, 65, 55, 50, 45, 40, 30, 18, 8, 5],
    [5, 5, 5, 5, 5, 5, 8, 18, 30, 38, 45, 55, 68, 68, 55, 50, 55, 60, 60, 55, 40, 25, 12, 6],
    [5, 5, 5, 5, 5, 5, 8, 18, 30, 38, 45, 55, 68, 68, 55, 50, 55, 60, 60, 55, 40, 25, 12, 6],
    [5, 5, 5, 5, 5, 5, 8, 18, 30, 40, 48, 60, 72, 72, 58, 52, 58, 62, 62, 55, 40, 25, 12, 6],
    [5, 5, 5, 5, 5, 5, 8, 18, 32, 42, 50, 62, 72, 72, 58, 55, 62, 70, 72, 65, 50, 32, 18, 8],
    [5, 5, 5, 5, 5, 5, 10, 22, 38, 48, 55, 68, 78, 78, 68, 65, 70, 80, 85, 82, 72, 55, 35, 18],
    [12, 8, 5, 5, 5, 5, 10, 20, 35, 55, 75, 88, 95, 95, 92, 88, 82, 78, 80, 80, 72, 55, 38, 22],
]

# Cells where enforcement actually observes demand. Hours 9-15 Mon-Sat get
# full data weight; hours 8 and 16 are shoulder cells with thinner coverage.
CORE_HOURS = set(range(9, 16))
SHOULDER_HOURS = {8, 16}
ENFORCED_DOWS = {1, 2, 3, 4, 5, 6}  # Mon-Sat; Sunday has no enforcement

DATA_WEIGHT_CORE = 0.6
DATA_WEIGHT_SHOULDER = 0.3

US_HOLIDAYS = {
    # closure-grade days with zero/near-zero enforcement; excluded so they
    # don't drag down cell means (the app handles holidays via holidayMod)
    "2022-01-01", "2022-01-17", "2022-02-21", "2022-05-30", "2022-06-20",
    "2022-07-04", "2022-09-05", "2022-10-10", "2022-11-11", "2022-11-24",
    "2022-12-25", "2022-12-26",
    "2023-01-01", "2023-01-02", "2023-01-16", "2023-02-20", "2023-05-29",
    "2023-06-19", "2023-07-04", "2023-09-04", "2023-10-09", "2023-11-10",
    "2023-11-23", "2023-12-25",
    "2024-01-01", "2024-01-15", "2024-02-19", "2024-05-27", "2024-06-19",
    "2024-07-04", "2024-09-02", "2024-10-14", "2024-11-11", "2024-11-28",
    "2024-12-25",
}


def load_citations(csv_path):
    df = pd.read_csv(csv_path, parse_dates=["issued_at"])
    df["d"] = df["issued_at"].dt.date.astype(str)
    df = df[~df["d"].isin(US_HOLIDAYS)].copy()
    df["dow"] = (df["issued_at"].dt.dayofweek + 1) % 7  # pandas Mon=0 -> app Sun=0
    df["hour"] = df["issued_at"].dt.hour
    df["year"] = df["issued_at"].dt.year
    df["month"] = df["issued_at"].dt.month
    return df


def fetch_weather():
    if os.path.exists(WEATHER_CACHE):
        with open(WEATHER_CACHE) as fh:
            return json.load(fh)
    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={LAT}&longitude={LON}"
        "&start_date=2022-01-01&end_date=2024-12-31"
        "&hourly=temperature_2m,precipitation,rain,snowfall,weather_code"
        "&timezone=America%2FNew_York&temperature_unit=fahrenheit"
        "&precipitation_unit=inch"
    )
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    payload = resp.json()["hourly"]
    os.makedirs(os.path.dirname(WEATHER_CACHE), exist_ok=True)
    with open(WEATHER_CACHE, "w") as fh:
        json.dump(payload, fh)
    return payload


def year_normalized_cell_means(df):
    """Mean citations per active hour for each (dow, hour), per-year scaled.

    Each year is scaled so its overall mean matches the pooled mean, washing
    out the 2023 staffing dip. Returns raw and patrol-adjusted matrices.
    """
    # days of each dow present per year (denominator for per-hour means)
    all_days = pd.DataFrame({
        "d": pd.date_range("2022-01-01", "2024-12-31", freq="D")
    })
    all_days["dstr"] = all_days["d"].dt.date.astype(str)
    all_days = all_days[~all_days["dstr"].isin(US_HOLIDAYS)]
    all_days["dow"] = (all_days["d"].dt.dayofweek + 1) % 7
    all_days["year"] = all_days["d"].dt.year
    days_per = all_days.groupby(["year", "dow"]).size().to_dict()

    counts = df.groupby(["year", "dow", "hour"]).size()
    # patrol presence: distinct (officer, date) pairs ticketing in the cell
    patrol = df.groupby(["year", "dow", "hour"]).apply(
        lambda g: g.drop_duplicates(["officer", "d"]).shape[0], include_groups=False
    )

    year_totals = df.groupby("year").size()
    pooled_mean = year_totals.mean()

    raw = [[0.0] * 24 for _ in range(7)]
    adj = [[0.0] * 24 for _ in range(7)]
    for dow in range(7):
        for hour in range(24):
            raw_vals, adj_vals = [], []
            for year in (2022, 2023, 2024):
                n_days = days_per.get((year, dow), 0)
                if not n_days:
                    continue
                scale = pooled_mean / year_totals[year]
                c = counts.get((year, dow, hour), 0) * scale
                p = patrol.get((year, dow, hour), 0)
                raw_vals.append(c / n_days)
                adj_vals.append((c / p) if p else 0.0)
            raw[dow][hour] = sum(raw_vals) / len(raw_vals) if raw_vals else 0.0
            adj[dow][hour] = sum(adj_vals) / len(adj_vals) if adj_vals else 0.0
    return raw, adj


def weather_glm(df, weather):
    import statsmodels.api as sm
    import statsmodels.formula.api as smf

    w = pd.DataFrame(weather)
    w["ts"] = pd.to_datetime(w["time"])
    w = w.set_index("ts")

    # hourly panel over enforcement window only
    hours = pd.date_range("2022-01-01", "2024-12-31 23:00", freq="h")
    panel = pd.DataFrame({"ts": hours})
    panel["dstr"] = panel["ts"].dt.date.astype(str)
    panel["dow"] = (panel["ts"].dt.dayofweek + 1) % 7
    panel["hour"] = panel["ts"].dt.hour
    panel["month"] = panel["ts"].dt.month
    panel = panel[
        panel["dow"].isin(ENFORCED_DOWS)
        & panel["hour"].isin(CORE_HOURS)
        & ~panel["dstr"].isin(US_HOLIDAYS)
    ]

    cit = df.copy()
    cit["ts"] = cit["issued_at"].dt.floor("h")
    cit_counts = cit.groupby("ts").size().rename("n")
    panel = panel.join(cit_counts, on="ts").fillna({"n": 0})
    panel = panel.join(w[["rain", "snowfall", "temperature_2m"]], on="ts")
    panel["raining"] = (panel["rain"] >= 0.01).astype(int)
    panel["snowing"] = (panel["snowfall"] >= 0.01).astype(int)
    panel["freezing"] = (panel["temperature_2m"] <= 32).astype(int)
    panel["warm_nice"] = (
        (panel["temperature_2m"] >= 65) & (panel["raining"] == 0) & (panel["snowing"] == 0)
    ).astype(int)

    model = smf.glm(
        "n ~ C(dow) + C(hour) + C(month) + raining + snowing + freezing + warm_nice",
        data=panel,
        family=sm.families.Poisson(),
    ).fit(cov_type="HC1")

    effects = {}
    for term in ("raining", "snowing", "freezing", "warm_nice"):
        rr = math.exp(model.params[term])
        lo, hi = (math.exp(x) for x in model.conf_int().loc[term])
        effects[term] = {
            "rate_ratio": round(rr, 3),
            "ci95": [round(lo, 3), round(hi, 3)],
            "n_hours": int(panel[term].sum()),
        }
    return effects, len(panel)


def build_new_priors(adj, raw):
    """Blend patrol-adjusted citation shape onto the old prior scale.

    Uses the patrol-adjusted shape ONLY: Saturdays get ~half the weekday
    patrol, so raw counts understate weekend demand — mixing raw back in
    would reintroduce the staffing schedule the adjustment exists to remove.
    (Officer-999's share is flat across days, 33-40%, so the adjustment
    isn't day-biased.)
    """
    del raw
    mx = max(v for row in adj for v in row) or 1.0
    shape = [[v / mx for v in row] for row in adj]

    # affine-map shape onto the old priors' own range inside the observed window
    window_cells = [
        (d, h) for d in ENFORCED_DOWS for h in (CORE_HOURS | SHOULDER_HOURS)
    ]
    old_in_window = [OLD_PRIORS[d][h] for d, h in window_cells]
    lo, hi = min(old_in_window), max(old_in_window)
    shape_in_window = [shape[d][h] for d, h in window_cells]
    smin, smax = min(shape_in_window), max(shape_in_window)

    def to_scale(v):
        if smax == smin:
            return lo
        return lo + (v - smin) / (smax - smin) * (hi - lo)

    new = [row[:] for row in OLD_PRIORS]
    provenance = []
    for d, h in window_cells:
        w = DATA_WEIGHT_CORE if h in CORE_HOURS else DATA_WEIGHT_SHOULDER
        data_val = to_scale(shape[d][h])
        blended = round(w * data_val + (1 - w) * OLD_PRIORS[d][h])
        blended = max(0, min(100, blended))
        if blended != OLD_PRIORS[d][h]:
            provenance.append({
                "dow": d, "hour": h, "old": OLD_PRIORS[d][h],
                "data_scaled": round(data_val, 1), "new": blended,
            })
        new[d][h] = blended
    return new, provenance


def main():
    csv_path = os.path.expanduser(
        sys.argv[1] if len(sys.argv) > 1
        else "~/Desktop/Parking Citations/citations_normalized.csv"
    )
    os.makedirs(OUT_DIR, exist_ok=True)

    df = load_citations(csv_path)
    print(f"citations after holiday exclusion: {len(df)}")

    raw, adj = year_normalized_cell_means(df)
    with open(os.path.join(OUT_DIR, "intensity_matrices.json"), "w") as fh:
        json.dump({"raw_per_day": raw, "patrol_adjusted": adj}, fh, indent=1)

    weather = fetch_weather()
    effects, n_panel = weather_glm(df, weather)
    with open(os.path.join(OUT_DIR, "weather_effects.json"), "w") as fh:
        json.dump({"panel_hours": n_panel, "effects": effects}, fh, indent=1)
    print(f"\nweather GLM over {n_panel} enforcement-window hours:")
    for k, v in effects.items():
        print(f"  {k:10s} rate ratio {v['rate_ratio']} (95% CI {v['ci95']}, {v['n_hours']} hrs)")

    new, provenance = build_new_priors(adj, raw)
    with open(os.path.join(OUT_DIR, "recalibrated_priors.json"), "w") as fh:
        json.dump({"new_priors": new, "changed_cells": provenance}, fh, indent=1)

    print(f"\nchanged cells: {len(provenance)}")
    days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
    for d in range(7):
        changes = [p for p in provenance if p["dow"] == d]
        if changes:
            desc = ", ".join(f"{p['hour']}h {p['old']}->{p['new']}" for p in changes)
            print(f"  {days[d]}: {desc}")


if __name__ == "__main__":
    main()
