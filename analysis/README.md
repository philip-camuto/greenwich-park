# analysis/ — Phase 2 demand-model pipeline

Python scripts that recalibrate the demand priors and fit/validate the
patrol-adjusted Poisson GLM that produces `src/lib/model/trained-coefficients.json`.

Everything here is offline analysis. Only `train_model.py` writes a runtime
artifact (`trained-coefficients.json`); the rest write to `analysis/out/`.

## Python environment (reproducible)

Retraining was blocked by a macOS Tahoe numpy ABI break: ephemeral
`uv run --with numpy ...` envs raise `ImportError: cannot import name randbits`
because the transient numpy build is ABI-incompatible with the interpreter.
Fix is a **real, persistent virtualenv with a pinned numpy** — `numpy==1.26.4`
is the last release with a clean wheel on this machine. Do not unpin it.

### Recreate the venv

This repo uses `uv` (Homebrew). `python3.13` is not on PATH directly, so let
`uv` provide the interpreter:

```sh
cd analysis
uv venv .venv --python 3.13          # creates ./analysis/.venv (CPython 3.13)
VIRTUAL_ENV="$(pwd)/.venv" uv pip install \
  "numpy==1.26.4" \
  "pandas==2.2.3" \
  "statsmodels==0.14.4" \
  "scipy==1.14.1" \
  "scikit-learn==1.5.2" \
  "patsy==1.0.1" \
  "requests==2.32.3"
```

Notes:
- `uv venv` does **not** install `pip` into the venv; use `uv pip install`
  (with `VIRTUAL_ENV` pointing at `.venv`) to populate it.
- Run only **one** `uv pip install` at a time. Two concurrent installs contend
  on the same venv/cache lock and neither finishes.
- `requests` is only needed by `recalibrate_priors.py` (Open-Meteo weather
  fetch). `scikit-learn` is only used by the (closed) GBM challenger
  `train_gbm.py`; it is pinned here so the one env runs every script.

### Verify before retraining

```sh
.venv/bin/python -c "import numpy; print('numpy', numpy.__version__)"
.venv/bin/python -c "import numpy,pandas,statsmodels,scipy,sklearn,patsy,requests; print('ok')"
```

Both must succeed (and print `1.26.4` for numpy) before running anything below.

## Source data

The raw FOIA citation feed is **not in the repo**. It lives at:

```
~/Desktop/Parking Citations/citations_normalized.csv
```

21,892 rows (Greenwich Parking Services, Jan 2022 – Dec 2024). Read it in place
only; do not move, copy, or modify it. The scripts take the path as `argv[1]`
and default to the location above.

Expected schema (one row per citation):

| column           | type   | notes                                                  |
| ---------------- | ------ | ------------------------------------------------------ |
| `citation_number`| int    | unique ticket id                                       |
| `issued_at`      | ISO ts | `YYYY-MM-DDTHH:MM:SS`; parsed with `parse_dates`        |
| `street`         | str    | e.g. `UGA`, `LGA`                                      |
| `officer`        | str    | officer id; `999` is a shared/system id (~35% of rows) |
| `zone`           | int    | zone id                                                |
| `zone_name`      | str    | e.g. `Greenwich, CT`                                   |
| `violation_type` | str    | e.g. `PARK METER VIOL`                                 |
| `base_amount`    | int    | fine amount                                            |
| `location`       | str    | street description                                     |
| `source_file`    | str    | originating spreadsheet                                |

`officer` + the date are used as the patrol-exposure key; `issued_at` drives
the day-of-week / hour / year / month derivations.

## Scripts and run order

Run from the repo root (or `analysis/`) with the venv interpreter. The CSV path
arg is optional (defaults to the Desktop location).

```sh
CSV="$HOME/Desktop/Parking Citations/citations_normalized.csv"
PY=analysis/.venv/bin/python

# 1. (optional) recalibrate the hand-prior blend + weather GLM.
#    Writes analysis/out/{intensity_matrices,weather_effects,recalibrated_priors}.json
#    Caches the Open-Meteo pull in analysis/data/weather_2022_2024.json.
$PY analysis/recalibrate_priors.py "$CSV"

# 2. train + temporal-holdout validation. Writes the runtime artifact
#    src/lib/model/trained-coefficients.json and analysis/out/model_metrics.json
$PY analysis/train_model.py "$CSV"

# 3. leave-one-year-out CV + bootstrap. Writes analysis/out/cv_report.json.
#    Imports from train_model, so run it from a cwd where that import resolves
#    (run from analysis/, or with analysis/ on PYTHONPATH).
cd analysis && .venv/bin/python cross_validate.py "$CSV"
```

`cross_validate.py` does `from train_model import ...`, so either `cd analysis`
first (as above) or set `PYTHONPATH=analysis`. `recalibrate_priors.py` only
feeds the runtime's 5%-weighted in-window blend anchor; the shipped trained
surface comes from `train_model.py`, so step 1 is optional for a pure retrain.

The weather fetch in step 1 hits Open-Meteo's archive API once and caches to
`analysis/data/weather_2022_2024.json`; later runs are offline.

## Outputs

| file                                         | written by            |
| -------------------------------------------- | --------------------- |
| `src/lib/model/trained-coefficients.json`    | `train_model.py`      |
| `analysis/out/model_metrics.json`            | `train_model.py`      |
| `analysis/out/cv_report.json`                | `cross_validate.py`   |
| `analysis/out/intensity_matrices.json`       | `recalibrate_priors.py` |
| `analysis/out/weather_effects.json`          | `recalibrate_priors.py` |
| `analysis/out/recalibrated_priors.json`      | `recalibrate_priors.py` |

## Holiday exclusions

`US_HOLIDAYS` (defined in both `train_model.py` and `recalibrate_priors.py`)
excludes closure-grade days **and**:
- **Black Friday** (2022-11-25, 2023-11-24, 2024-11-29) — normal enforcement
  plus a once-a-year retail spike that would inflate the late-Nov Friday
  baseline; the runtime also adds its own `holidayMod` spike that day, so
  training on it double-counts.
- **Dec 24 / Dec 31** — grace-enforcement days that deflate those cells.
