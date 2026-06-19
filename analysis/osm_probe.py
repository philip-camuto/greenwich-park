"""
osm_probe.py — OSM coverage check for downtown Greenwich Ave.

Run BEFORE building the real osm_geometry.py artifact. Answers two questions:
  1. CAPACITY half: does OSM have the Greenwich Ave centerline + named cross
     streets, with usable segment lengths? (street data is usually good)
  2. RELIEF half: does OSM have the rear parking lots as `amenity=parking`
     polygons we can route to? (suburban CT lot coverage is the risk)

Reports counts + a sample so a human can eyeball quality. Writes nothing.

Run:
  cd analysis
  VIRTUAL_ENV="$(pwd)/.venv-osm" .venv-osm/bin/python osm_probe.py
"""

import osmnx as ox

PLACE = "Greenwich Avenue, Greenwich, CT, USA"

# Cross streets that bound the 6 model blocks, north -> south. These are the
# names per-block.ts / avenue-map-data.ts use as block boundaries.
CROSS_STREETS = [
    "Putnam Avenue", "Elm Street", "Lewis Street", "Mason Street",
    "Havemeyer Place", "Arch Street", "Steamboat Road", "Railroad Avenue",
    "Bolling Place", "Lewis Court",
]


def main() -> None:
    # A street geocodes to a line, not a polygon, so geocode_to_gdf rejects it.
    # Use a fixed bbox over downtown Greenwich Ave (Putnam end -> railroad end),
    # padded to capture rear lots. (W, S, E, N).
    bbox = (-73.6300, 41.0218, -73.6235, 41.0325)
    print(f"== downtown bbox (W,S,E,N) = {bbox} ==")

    print("\n== CAPACITY: drive network + named segments ==")
    G = ox.graph_from_bbox(bbox, network_type="drive")
    edges = ox.graph_to_gdfs(G, nodes=False)
    edges = edges.to_crs(edges.estimate_utm_crs())  # meters for length

    def named(gdf, name):
        def hit(v):
            if isinstance(v, list):
                return any(name.lower() in str(x).lower() for x in v)
            return name.lower() in str(v).lower()
        return gdf[gdf["name"].apply(hit)] if "name" in gdf else gdf.iloc[0:0]

    ave_edges = named(edges, "Greenwich Avenue")
    print(f"  Greenwich Avenue segments: {len(ave_edges)}")
    print(f"  total Ave length:          {ave_edges['length'].sum():.0f} m")
    print("  cross-street presence:")
    for cs in CROSS_STREETS:
        n = len(named(edges, cs))
        flag = "ok" if n else "MISSING"
        print(f"    {cs:<20} {n:>2} seg  {flag}")

    print("\n== RELIEF: amenity=parking polygons ==")
    try:
        lots = ox.features_from_bbox(bbox, tags={"amenity": "parking"})
        polys = lots[lots.geometry.type.isin(["Polygon", "MultiPolygon"])]
        print(f"  parking features: {len(lots)} ({len(polys)} polygons)")
        lots_m = polys.to_crs(polys.estimate_utm_crs())
        for idx, row in lots_m.head(20).iterrows():
            nm = row.get("name", "(unnamed)")
            cap = row.get("capacity", "")
            area = row.geometry.area
            print(f"    {str(nm)[:34]:<34} area={area:6.0f} m2  capacity_tag={cap}")
    except Exception as e:  # noqa: BLE001 - probe should report, not crash
        print(f"  parking query failed: {e}")

    print("\n== walk network sanity (for lot->anchor routing) ==")
    Gw = ox.graph_from_bbox(bbox, network_type="walk")
    print(f"  walk graph: {Gw.number_of_nodes()} nodes, {Gw.number_of_edges()} edges")


if __name__ == "__main__":
    main()
