"""
osm_geometry.py — derive Greenwich Ave block geometry from OpenStreetMap.

OFFLINE build-time tool. Emits a static artifact the TS app imports; OSMnx is
never a runtime dependency (the app is Next.js on Vercel).

Design principle proven by osm_probe.py: **OSM defines geometry, not semantics.**
OSM has excellent street centerlines but its downtown-Greenwich parking polygons
are almost all untagged (no capacity, no name). So:
  - CAPACITY (on-street): trusted. Avenue segment length between consecutive
    mapped cross-street intersections / ~6.5 m per parallel space.
  - RELIEF (rear lots): we pick "significant public lots" by a defensible
    geometric filter (area + proximity to the avenue), NOT by trusting absent
    tags, then compute real walk-network distance anchor -> nearest lot.

Block model (north -> south), boundary cross streets, anchor address:

   block id           N boundary   S boundary    anchor (geocoded)
   ─────────────────  ──────────   ──────────    ──────────────────
   lafayette__elm     Putnam       Elm           10 Greenwich Ave
   elm__lewis         Elm          Lewis         99 Greenwich Ave
   lewis__mason       Lewis        Mason         205 Greenwich Ave
   mason__havemeyer   Mason        Havemeyer     289 Greenwich Ave
   havemeyer__arch    Havemeyer    Arch          310 Greenwich Ave
   arch__railroad     Arch         (S terminus)  409 Greenwich Ave

Railroad/Steamboat (south terminus) is unnamed in OSM here, so the last block
is cut at the avenue's southernmost node instead of a named street.

Run:
  cd analysis
  VIRTUAL_ENV="$(pwd)/.venv-osm" .venv-osm/bin/python osm_geometry.py
Writes: ../src/lib/inventory/osm-geometry.json
"""

from __future__ import annotations

import json
from pathlib import Path

import networkx as nx
import osmnx as ox

import osm_common as common
from osm_common import BBOX, BLOCK_ORDER

# Average curb length consumed by one parallel on-street space (car + gap).
# 6.5 m is the standard planning figure for parallel parking.
METERS_PER_SPACE = 6.5
# Greenwich Ave parks BOTH sides, so usable curb is ~2x the centerline length.
SIDES = 2
# ~20% of curb is unparkable: hydrants, driveway cuts, corner clearances, bus
# stops, loading zones. A flat fraction now; refine per-block with FOIA counts.
PARKABLE_FRACTION = 0.80

# Relief routes to public-candidate lots (defined in osm_common).

OUT = Path(__file__).resolve().parent.parent / "src" / "lib" / "inventory" / "osm-geometry.json"


def main() -> None:
    print(f"== load drive network {BBOX} ==")
    G = ox.graph_from_bbox(BBOX, network_type="drive")
    edges = ox.graph_to_gdfs(G, nodes=False)
    utm = edges.estimate_utm_crs()

    # Geocode anchors once (reliable: street addresses); reused for capacity
    # (chainage) and relief (walk routing). Shared avenue/block geometry lives
    # in osm_common so osm_lots.py splits blocks identically.
    anchor_ll = common.geocode_anchors()
    merged, ave_edges = common.avenue_line(edges, utm)
    ave_len = merged.length
    print(f"  Greenwich Ave: {len(ave_edges)} segments, {ave_len:.0f} m")

    # CAPACITY: project anchors onto the avenue to get chainage (metres from the
    # north end), then split capacity at the midpoints between consecutive
    # anchors. Lengths sum to the avenue total exactly: no gaps, no overlaps.
    #
    #   N end |--b0--*--b1--*--b2--*--b3--*--b4--*--b5--| S end
    #               a0      a1  ...   (anchors *, cuts at midpoints)
    order = BLOCK_ORDER
    chain, cuts = common.block_cuts(anchor_ll, merged, utm)
    if any(chain[i] >= chain[i + 1] for i in range(len(chain) - 1)):
        print(f"  WARN anchor chainage not monotonic N->S: {[round(c) for c in chain]}")

    print("\n== CAPACITY per block (anchor-chainage split, both sides) ==")
    blocks_out = []
    for i, block_id in enumerate(order):
        seg_m = max(0.0, cuts[i + 1] - cuts[i])
        # Both sides of the curb, minus the unparkable fraction.
        spaces = round(SIDES * seg_m * PARKABLE_FRACTION / METERS_PER_SPACE)
        blocks_out.append({
            "blockId": block_id,
            "segmentMeters": round(seg_m, 1),
            "onStreetSpaces": spaces,
        })
        print(f"  {block_id:<18} {seg_m:6.1f} m  -> {spaces:3d} on-street spaces")
    print(f"  avenue total {ave_len:.0f} m, on-street total "
          f"{sum(b['onStreetSpaces'] for b in blocks_out)} spaces")

    print("\n== RELIEF: walk distance to nearest PUBLIC lot ==")
    raw = ox.features_from_bbox(BBOX, tags={"amenity": "parking"})
    ave_geom_m = ave_edges.to_crs(utm).geometry.union_all()
    # Route only to public-candidate lots (the shared definition), not to any
    # parking polygon -- a parker can't use a private driveway. This is the
    # correctness fix: "nearest lot" now means "nearest lot you can actually use".
    pub = common.public_lots(raw, ave_geom_m, utm)
    print(f"  {len(pub)} public-candidate lots in range")

    # Walk network for routing anchors -> lots.
    Gw = ox.graph_from_bbox(BBOX, network_type="walk")
    # Centroids in projected metres (geographic-CRS centroids are wrong), then
    # back to lon/lat for nearest-node snapping. Carry each lot's capacity so we
    # can sum reachable spaces, not just measure the nearest one.
    lot_centroids = pub.geometry.centroid.to_crs(4326)
    lot_nodes = [ox.distance.nearest_nodes(Gw, p.x, p.y) for p in lot_centroids]
    lot_spaces = [common.derived_spaces(a) for a in pub["area_m2"]]

    # CATCHMENT: not just the nearest lot, but how many public spaces are within
    # a short walk. ~80 m/min walking. This is the real "relief" -- accessible
    # supply, not a single distance.
    WALK_M_PER_MIN = 80
    CATCHMENT_MIN = [2, 5]

    relief_by_block: dict[str, dict] = {}
    for block_id in order:
        lat, lon = anchor_ll[block_id]
        anode = ox.distance.nearest_nodes(Gw, lon, lat)
        reach = []  # (walk_metres, spaces) per reachable public lot
        for lnode, spaces in zip(lot_nodes, lot_spaces):
            try:
                d = nx.shortest_path_length(Gw, anode, lnode, weight="length")
            except nx.NetworkXNoPath:
                continue
            reach.append((d, spaces))
        nearest = round(min(d for d, _ in reach)) if reach else None
        within = {
            m: sum(s for d, s in reach if d <= m * WALK_M_PER_MIN)
            for m in CATCHMENT_MIN
        }
        relief_by_block[block_id] = {"nearest": nearest, "within": within}
        print(f"  {block_id:<18} nearest {str(nearest)+'m':>6}  "
              f"2min={within[2]:>4} sp  5min={within[5]:>4} sp")

    for b in blocks_out:
        r = relief_by_block.get(b["blockId"], {})
        b["nearestLotWalkMeters"] = r.get("nearest")
        b["publicSpacesWithin2min"] = r.get("within", {}).get(2, 0)
        b["publicSpacesWithin5min"] = r.get("within", {}).get(5, 0)

    artifact = {
        "_meta": {
            "source": "OpenStreetMap via OSMnx",
            "generator": "analysis/osm_geometry.py",
            "metersPerSpace": METERS_PER_SPACE,
            "sides": SIDES,
            "parkableFraction": PARKABLE_FRACTION,
            "publicHintAreaM2": common.PUBLIC_HINT_AREA_M2,
            "publicHintDistM": common.PUBLIC_HINT_DIST_M,
            "publicLots": int(len(pub)),
            "m2PerStall": common.M2_PER_STALL,
            "catchmentWalkMPerMin": 80,
            "note": "Offline-derived. onStreetSpaces = sides * segment length * "
                    "parkableFraction / metersPerSpace (both curb sides, minus "
                    "unparkable). Relief = walk-network distance + reachable public "
                    "spaces (catchment) from the block anchor to PUBLIC-candidate lots "
                    "(not any parking polygon). OSM defines geometry only; public split "
                    "is a size+proximity heuristic.",
        },
        "blocks": blocks_out,
    }
    OUT.write_text(json.dumps(artifact, indent=2) + "\n")
    print(f"\nwrote {OUT.relative_to(OUT.parents[3])}")


if __name__ == "__main__":
    main()
