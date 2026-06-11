// Four hand-picked landmarks on Greenwich Ave. Each maps to a block id from
// `avenue-map-data.ts`. Phase 1: per-hotspot score = its block's per-block
// score (which itself is global score + block.offset).

export type Hotspot = {
  id: string;
  name: string;
  address: string;
  subLabel: string; // shown under the name on the drill-down page
  blockId: string;
};

export const HOTSPOTS: Hotspot[] = [
  {
    id: "ginger-man",
    name: "The Ginger Man",
    address: "64 Greenwich Ave",
    subLabel: "Top of the Ave, Putnam to Elm",
    blockId: "lafayette__elm",
  },
  {
    id: "saks",
    name: "Saks Fifth Avenue",
    address: "205 Greenwich Ave",
    subLabel: "Mid-Ave, Lewis to Mason",
    blockId: "lewis__mason",
  },
  {
    id: "rh-gallery",
    name: "RH Gallery",
    address: "310 Greenwich Ave",
    subLabel: "Lower-mid Ave, Havemeyer to Arch",
    blockId: "havemeyer__arch",
  },
  {
    id: "apple",
    name: "Apple",
    address: "356 Greenwich Ave",
    subLabel: "Bottom of the Ave, Arch to Railroad",
    blockId: "arch__railroad",
  },
];

export function hotspotById(id: string): Hotspot | null {
  return HOTSPOTS.find((h) => h.id === id) ?? null;
}
