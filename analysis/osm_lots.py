"""
osm_lots.py — measure off-street parking footprints near Greenwich Ave from OSM.

OFFLINE build-time tool. Emits src/lib/inventory/osm-lots.json, consumed by
src/lib/inventory/osm-lots.ts. Replaces the eyeballed-from-satellite off-street
counts in inventory/data.ts with footprint-derived measurements, and flags the
gap (the reconciliation lives in the TS layer against the live inventory total).

What the OSM tags forced (verified before building):
  - NO `access` tags downtown -> OSM cannot tell public from private. So this
    measures ALL off-street footprint near the Ave (public + private). The
    inventory's off_ave_lot zones are PUBLIC rear lots only: a SUBSET. The
    totals are deliberately NOT treated as the same population.
  - `parking=street_side` (21 polygons) is on-street curb, already counted by
    osm_geometry.py. EXCLUDED here to avoid double counting.
  - `parking=multi-storey` (garages): footprint area undercounts a stacked deck.
    Flagged; derived spaces are a FLOOR (one level), not a true count.
  - Only 1 lot is named ("Town Hall Parking"), so per-zone 1:1 matching would be
    guesswork. We measure + assign to blocks + flag large near-Ave lots as
    likely-public, and leave naming to a human.

Run:
  cd analysis
  VIRTUAL_ENV="$(pwd)/.venv-osm" .venv-osm/bin/python osm_lots.py
Writes: ../src/lib/inventory/osm-lots.json
"""

from __future__ import annotations

import json
from pathlib import Path

import osmnx as ox

import osm_common as common
from osm_common import M2_PER_STALL

# A polygon must be at least this big to be a "lot" (smaller = driveway / single
# space), and within this many metres of the avenue to be downtown-Ave parking.
MIN_LOT_AREA_M2 = 150.0
MAX_LOT_DIST_M = 180.0
# The public/private split (PUBLIC_HINT_*) lives in osm_common, shared with the
# relief routing in osm_geometry.py.

OUT = Path(__file__).resolve().parent.parent / "src" / "lib" / "inventory" / "osm-lots.json"


def _str(v) -> str | None:
    if v is None or (isinstance(v, float) and v != v):  # NaN
        return None
    return str(v)


def main() -> None:
    print(f"== load network + avenue {common.BBOX} ==")
    G = ox.graph_from_bbox(common.BBOX, network_type="drive")
    edges = ox.graph_to_gdfs(G, nodes=False)
    utm = edges.estimate_utm_crs()
    anchor_ll = common.geocode_anchors()
    merged, ave_edges = common.avenue_line(edges, utm)
    _, cuts = common.block_cuts(anchor_ll, merged, utm)
    ave_geom = ave_edges.to_crs(utm).geometry.union_all()

    print("== parking polygons ==")
    feats = ox.features_from_bbox(common.BBOX, tags={"amenity": "parking"})
    feats = feats[feats.geometry.type.isin(["Polygon", "MultiPolygon"])].to_crs(utm)
    feats["area_m2"] = feats.geometry.area
    feats["dist_to_ave"] = feats.geometry.distance(ave_geom)
    cent_ll = feats.geometry.centroid.to_crs(4326)  # for map links / curation
    ptype = feats["parking"] if "parking" in feats else None
    name = feats["name"] if "name" in feats else None

    dropped_street_side = 0
    lots = []
    for i, (idx, row) in enumerate(feats.iterrows()):
        pk = _str(ptype.iloc[i]) if ptype is not None else None
        if pk == "street_side":  # on-street curb; counted by osm_geometry.py
            dropped_street_side += 1
            continue
        area = row["area_m2"]
        dist = row["dist_to_ave"]
        if area < MIN_LOT_AREA_M2 or dist > MAX_LOT_DIST_M:
            continue
        multi = pk == "multi-storey"
        centroid = row.geometry.centroid
        block_id = common.block_for_chainage(merged.project(centroid), cuts)
        ll = cent_ll.iloc[i]
        # OSM index is (element_type, osmid) -> stable id like "way/12345".
        osm_id = "/".join(str(p) for p in (idx if isinstance(idx, tuple) else (idx,)))
        lots.append({
            "id": osm_id,
            "areaM2": round(area, 0),
            "derivedSpaces": common.derived_spaces(area),
            "parkingType": pk,
            "multiStorey": multi,
            "name": _str(name.iloc[i]) if name is not None else None,
            "blockId": block_id,
            "distToAveM": round(dist, 0),
            "lat": round(ll.y, 6),
            "lon": round(ll.x, 6),
            "candidatePublic": bool(common.is_public_candidate(area, dist)),
        })

    lots.sort(key=lambda x: -x["areaM2"])

    by_block = []
    for bid in common.BLOCK_ORDER:
        blk = [x for x in lots if x["blockId"] == bid]
        by_block.append({
            "blockId": bid,
            "lotCount": len(blk),
            "offStreetSpaces": sum(x["derivedSpaces"] for x in blk),
        })

    total_spaces = sum(x["derivedSpaces"] for x in lots)
    n_public = sum(1 for x in lots if x["candidatePublic"])
    print(f"  {len(lots)} off-street lots ({dropped_street_side} street_side dropped), "
          f"~{total_spaces} spaces, {n_public} likely-public")
    for x in lots[:12]:
        tag = "PUBLIC?" if x["candidatePublic"] else "       "
        ms = " [multi-storey: floor]" if x["multiStorey"] else ""
        print(f"  {tag} {x['areaM2']:6.0f} m2 -> {x['derivedSpaces']:3d} sp  "
              f"{x['blockId']:<18} d={x['distToAveM']:.0f}m{ms}")

    artifact = {
        "_meta": {
            "source": "OpenStreetMap via OSMnx",
            "generator": "analysis/osm_lots.py",
            "m2PerStall": M2_PER_STALL,
            "minLotAreaM2": MIN_LOT_AREA_M2,
            "maxLotDistM": MAX_LOT_DIST_M,
            "droppedStreetSide": dropped_street_side,
            "population": "ALL off-street parking footprint near the Ave (public + "
                          "private). OSM has no access tags downtown. The inventory's "
                          "off_ave_lot zones are PUBLIC rear lots only -- a subset. "
                          "Totals are NOT the same population; reconcile with care.",
            "multiStoreyNote": "multi-storey: derivedSpaces is a one-level FLOOR, "
                               "true count is higher.",
            "lotCount": len(lots),
            "offStreetSpaces": total_spaces,
        },
        "lots": lots,
        "byBlock": by_block,
    }
    OUT.write_text(json.dumps(artifact, indent=2) + "\n")
    print(f"\nwrote {OUT.relative_to(OUT.parents[3])}")


if __name__ == "__main__":
    main()
