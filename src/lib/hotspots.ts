// Four hand-picked landmarks on Greenwich Ave. Each maps to a block id from
// `avenue-map-data.ts`. Phase 1: per-hotspot score = its block's per-block
// score (which itself is global score + block.offset).

export type Hotspot = {
  id: string;
  name: string;
  address: string;
  subLabel: string; // shown under the name on the drill-down page
  blockId: string;
  // Anchor business opening hours, local time, close exclusive. "Best time"
  // on the drill-down page only considers [open, close) — recommending
  // midnight at a store that closed at 6pm is worse than no recommendation.
  hours: { open: number; close: number };
};

export const HOTSPOTS: Hotspot[] = [
  {
    id: "ginger-man",
    name: "The Ginger Man",
    address: "64 Greenwich Ave",
    subLabel: "Top of the Ave, Putnam to Elm",
    blockId: "lafayette__elm",
    hours: { open: 11, close: 22 }, // restaurant/bar: opens 11:30am, kitchen until ~10pm
  },
  {
    id: "saks",
    name: "Saks Fifth Avenue",
    address: "205 Greenwich Ave",
    subLabel: "Mid-Ave, Lewis to Mason",
    blockId: "lewis__mason",
    hours: { open: 10, close: 18 }, // 10am-6pm
  },
  {
    id: "rh-gallery",
    name: "RH Gallery",
    address: "310 Greenwich Ave",
    subLabel: "Lower-mid Ave, Havemeyer to Arch",
    blockId: "havemeyer__arch",
    hours: { open: 10, close: 19 }, // 10am-7pm
  },
  {
    id: "apple",
    name: "Apple",
    address: "356 Greenwich Ave",
    subLabel: "Bottom of the Ave, Arch to Railroad",
    blockId: "arch__railroad",
    hours: { open: 10, close: 20 }, // 10am-8pm
  },
];

export function hotspotById(id: string): Hotspot | null {
  return HOTSPOTS.find((h) => h.id === id) ?? null;
}
