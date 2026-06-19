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
| `src/lib/inventory/osm-geometry.json`        | `osm_geometry.py`     |
| `src/lib/inventory/osm-lots.json`            | `osm_lots.py`         |

## OSM geometry (separate venv: `.venv-osm`)

`osm_geometry.py` derives per-block on-street capacity and walk-distance relief
from OpenStreetMap via OSMnx, and writes `src/lib/inventory/osm-geometry.json`
(consumed at build time by `src/lib/inventory/osm-geometry.ts`). OSMnx is never
a runtime dependency.

This lives in its **own** venv, `analysis/.venv-osm`, NOT the ML `.venv`. The
geospatial stack (osmnx, geopandas, shapely, pyproj) pulls `pandas>=3`, which
would break the ML pipeline's pinned `pandas==2.2.3`. Keep them separate.

```sh
cd analysis
uv venv .venv-osm --python 3.13
VIRTUAL_ENV="$(pwd)/.venv-osm" uv pip install \
  "numpy==1.26.4" "osmnx>=2.0,<3" geopandas shapely networkx scikit-learn scipy
#   numpy stays pinned (Tahoe ABI break); scikit-learn enables nearest_nodes.

# Probe OSM coverage first (writes nothing):
VIRTUAL_ENV="$(pwd)/.venv-osm" .venv-osm/bin/python osm_probe.py
# Per-block curb capacity + walk-distance relief:
VIRTUAL_ENV="$(pwd)/.venv-osm" .venv-osm/bin/python osm_geometry.py
# Off-street lot footprints -> measured capacity:
VIRTUAL_ENV="$(pwd)/.venv-osm" .venv-osm/bin/python osm_lots.py
# Propose OSM-lot <-> inventory-zone matches for human review:
VIRTUAL_ENV="$(pwd)/.venv-osm" .venv-osm/bin/python lot_curation.py
```

`osm_common.py` holds the shared avenue/block-split geometry both scripts use
(anchor chainage), so it's defined once.

Method notes (why it's built this way):
- **OSM defines geometry, not semantics.** Downtown-Greenwich parking polygons
  are almost all untagged (no capacity, no name), so lots are selected by an
  area+proximity filter, not by trusting tags.
- **Blocks are split by anchor chainage, not cross streets.** OSM's minor-street
  names near the avenue are unreliable (Lewis Ct vs Lewis St; no "Mason" on the
  Ave; Lewis/Elm ordered opposite the model). We project each block's anchor
  address onto the avenue centerline and cut at the midpoints between anchors.
- **Capacity is both curb sides minus an unparkable fraction**
  (`sides * length * parkableFraction / 6.5 m`, sides=2, parkable=0.80). Total
  ~223 spaces, close to the 231 hand estimate but per-block and geometry-grounded.
  Refine `parkableFraction` per block once FOIA counts land.
- **Relief routes to public lots only.** Walk distance is anchor -> nearest
  *public-candidate* lot (size+proximity heuristic in `osm_common`), not any
  parking polygon. Correctness fix: a parker can't use a private driveway, so
  e.g. elm__lewis reads 166m (nearest usable lot) not 0m (an adjacent driveway).
- **Catchment, not just nearest.** Each block also gets `publicSpacesWithin2min`
  / `within5min`: public lot spaces reachable on foot (~80 m/min) via the walk
  network. This is the real relief signal -- accessible supply, not one distance.
  e.g. lewis__mason reaches 322 spaces in 2 min, elm__lewis reaches 0 (its
  nearest public lot is just past the 2-min line) but 380 in 5 min.
- The TS layer is **additive**: `osm-geometry.ts` exposes the numbers and
  `tierDisagreements()` flags where geometry contradicts the hand-tuned tiers in
  `per-block.ts` (e.g. lewis__mason). It does NOT auto-change the live model.
- `block-supply.ts` is the **assembled best estimate**: it consolidates both OSM
  artifacts, taking on-street (both-sides curb, HIGH confidence) + walk distance
  from `osm-geometry`, and public off-street footprint (MEDIUM confidence, a
  size/distance heuristic) from `osm-lots`, with per-field provenance. The block
  drill-down surfaces it. Still additive; the live model keeps its hand tiers.

### Off-street lots (`osm_lots.py`)

Measures every off-street parking footprint near the Ave and derives capacity
from area (`area / 30 m² per stall`). Honest about what OSM can and can't say:
- **No `access` tags downtown**, so this is ALL footprint (public + private):
  ~3,380 spaces across 72 lots. The inventory's `off_ave_lot` zones are PUBLIC
  rear lots only (~443) -- a subset. `osm-lots.ts` `offStreetReconciliation()`
  frames the gap as a population difference, not an inventory error.
- `parking=street_side` is excluded (on-street, counted by `osm_geometry.py`).
- `multi-storey` garages: area-derived spaces are a one-level FLOOR.
- Only one lot is named in OSM, so lots are assigned to blocks and large
  near-Ave ones flagged `candidatePublic`; naming the real public lots is left
  to a human. `lot_curation.py` jump-starts that: it geocodes each inventory
  zone's reference, proposes the nearest OSM public lot with confidence + a map
  link, and writes `analysis/out/lot-curation-worksheet.md` to confirm by hand.
  It does NOT edit `data.ts`.

### Validation vs citations (limited)

The 21,892-ticket FOIA export only resolves to Upper vs Lower Greenwich Ave
(`street` = UGA/LGA), not blocks, and citations measure enforcement, not
occupancy. The honest check that's possible: OSM on-street capacity is 57%
upper, citations are 53% upper — directionally consistent within 4 points. A
mild positive signal, not a per-block validation. Real validation waits on
block-resolved counts.

## Holiday exclusions

`US_HOLIDAYS` (defined in both `train_model.py` and `recalibrate_priors.py`)
excludes closure-grade days **and**:
- **Black Friday** (2022-11-25, 2023-11-24, 2024-11-29) — normal enforcement
  plus a once-a-year retail spike that would inflate the late-Nov Friday
  baseline; the runtime also adds its own `holidayMod` spike that day, so
  training on it double-counts.
- **Dec 24 / Dec 31** — grace-enforcement days that deflate those cells.
