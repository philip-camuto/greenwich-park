"""
osm_common.py — shared OSM geometry helpers for the Greenwich Ave block model.

Both osm_geometry.py (curb capacity + walk relief) and osm_lots.py (off-street
footprint) split the avenue into blocks the same way: project each block's
anchor address onto the avenue centerline and cut at the midpoints between
anchors. That logic lives here so it is defined once.

See osm_geometry.py's module docstring for why anchors, not cross streets.
"""

from __future__ import annotations

import geopandas as gpd
import osmnx as ox
from shapely.geometry import LineString, Point
from shapely.ops import linemerge

# (W, S, E, N) over downtown Greenwich Ave, padded to capture rear lots.
BBOX = (-73.6300, 41.0218, -73.6235, 41.0325)

# Anchor address per block, N->S. Drives the capacity split and block assignment.
ANCHORS = {
    "lafayette__elm": "10 Greenwich Avenue, Greenwich, CT, USA",
    "elm__lewis": "99 Greenwich Avenue, Greenwich, CT, USA",
    "lewis__mason": "205 Greenwich Avenue, Greenwich, CT, USA",
    "mason__havemeyer": "289 Greenwich Avenue, Greenwich, CT, USA",
    "havemeyer__arch": "310 Greenwich Avenue, Greenwich, CT, USA",
    "arch__railroad": "409 Greenwich Avenue, Greenwich, CT, USA",
}
BLOCK_ORDER = list(ANCHORS.keys())  # already N->S


def named_edges(edges, name: str):
    """Edges whose `name` contains `name` (handles list-valued names)."""
    if "name" not in edges:
        return edges.iloc[0:0]

    def hit(v):
        if isinstance(v, list):
            return any(name.lower() in str(x).lower() for x in v)
        return name.lower() in str(v).lower()

    return edges[edges["name"].apply(hit)]


def avenue_line(edges, utm):
    """Single Greenwich Ave centerline (projected metres), oriented N->S.

    Returns (merged_line, ave_edges). UTM y increases north, so we flip the line
    if it starts at the south end.
    """
    ave = named_edges(edges, "Greenwich Avenue")
    merged = linemerge(ave.to_crs(utm).geometry.union_all())
    if merged.geom_type == "MultiLineString":
        merged = max(merged.geoms, key=lambda g: g.length)  # the through-line
    if merged.coords[0][1] < merged.coords[-1][1]:
        merged = LineString(list(merged.coords)[::-1])
    return merged, ave


def block_cuts(anchor_ll: dict, merged, utm):
    """Chainage cuts (metres from the N end) that split the avenue into blocks.

    cut[0]=0, cut[i]=midpoint between anchor i-1 and i, cut[-1]=avenue length.
    Returns (chain, cuts) where chain[i] is anchor i's distance from the N end.
    """
    pts = gpd.GeoSeries(
        [Point(anchor_ll[b][1], anchor_ll[b][0]) for b in BLOCK_ORDER], crs=4326
    ).to_crs(utm)
    chain = [merged.project(p) for p in pts]
    cuts = (
        [0.0]
        + [(chain[i - 1] + chain[i]) / 2 for i in range(1, len(BLOCK_ORDER))]
        + [merged.length]
    )
    return chain, cuts


def block_for_chainage(c: float, cuts: list[float]) -> str:
    """Block whose avenue span [cut_i, cut_i+1] contains chainage c."""
    for i in range(len(BLOCK_ORDER)):
        if cuts[i] <= c <= cuts[i + 1]:
            return BLOCK_ORDER[i]
    return BLOCK_ORDER[-1] if c > cuts[-1] else BLOCK_ORDER[0]


def geocode_anchors() -> dict:
    """{block_id: (lat, lon)} for each anchor address (reliable: street addrs)."""
    return {bid: ox.geocode(addr) for bid, addr in ANCHORS.items()}


# A lot this big (m^2) and this close to the Ave reads as a public/commercial
# lot, not a private driveway. OSM has no `access` tags downtown, so this
# size+proximity heuristic is the best public/private split available. Defined
# once here; used by osm_lots.py (candidatePublic flag) and osm_geometry.py
# (relief routes to public lots only, not any parking polygon).
PUBLIC_HINT_AREA_M2 = 1800.0
PUBLIC_HINT_DIST_M = 100.0

# Gross m^2 per surface stall, including drive aisles (ULI/ITE ~300-350 sqft).
# Shared by osm_lots.py (per-lot capacity) and osm_geometry.py (catchment).
M2_PER_STALL = 30.0


def derived_spaces(area_m2: float) -> int:
    """Footprint area -> estimated stalls (surface-lot assumption)."""
    return round(area_m2 / M2_PER_STALL)


def is_public_candidate(area_m2: float, dist_to_ave: float) -> bool:
    """Whether a lot is large + close enough to read as public/commercial."""
    return area_m2 >= PUBLIC_HINT_AREA_M2 and dist_to_ave <= PUBLIC_HINT_DIST_M


def public_lots(feats, ave_geom_m, utm):
    """Public-candidate off-street lots near the Ave (not street_side curb).

    `feats` is the raw amenity=parking GeoDataFrame; returns it projected to
    `utm` with area_m2 + dist_to_ave columns, filtered to public candidates.
    """
    f = feats.to_crs(utm).copy()
    f = f[f.geometry.type.isin(["Polygon", "MultiPolygon"])]
    f["area_m2"] = f.geometry.area
    f["dist_to_ave"] = f.geometry.distance(ave_geom_m)
    keep = f.apply(
        lambda r: is_public_candidate(r["area_m2"], r["dist_to_ave"]), axis=1
    )
    if "parking" in f:
        keep = keep & (f["parking"] != "street_side")  # curb, not a lot
    return f[keep]
