// One landmark per Greenwich Ave block, ordered top (Putnam) to bottom
// (Railroad) so the list reads down the avenue in the same order as the map.
// Each maps to a block id from `avenue-map-data.ts`. Phase 1: per-hotspot
// score = its block's per-block score (which itself is global score +
// block.offset).

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

// All addresses + hours verified against the businesses' own sites / current
// listings (June 2026), not guessed. The `hours` window is a single open/close
// and can't encode closed days — noted per entry where it matters (La Taqueria
// closed Fri, Hermès closed Sun); only affects the per-hotspot "best time".
export const HOTSPOTS: Hotspot[] = [
  {
    id: "la-taqueria",
    name: "La Taqueria",
    address: "10 Greenwich Ave",
    subLabel: "Top of the Ave, Putnam to Elm",
    blockId: "lafayette__elm",
    hours: { open: 11, close: 21 }, // Mon-Thu & Sat 11a-9p, Sun 11a-8p; closed Fri
  },
  {
    id: "cvs",
    name: "CVS",
    address: "99 Greenwich Ave",
    subLabel: "Upper-mid Ave, Elm to Lewis",
    blockId: "elm__lewis",
    hours: { open: 7, close: 23 }, // 7a-11p daily
  },
  {
    id: "saks",
    name: "Saks Fifth Avenue",
    address: "205 Greenwich Ave",
    subLabel: "Mid-Ave, Lewis to Mason",
    blockId: "lewis__mason",
    hours: { open: 11, close: 18 }, // Mon-Sat 11a-6p, Sun 12-6p
  },
  {
    id: "hermes",
    name: "Hermès",
    address: "289 Greenwich Ave",
    subLabel: "Mid-Ave, Mason to Havemeyer",
    blockId: "mason__havemeyer",
    hours: { open: 11, close: 18 }, // Mon-Sat 11a-6p; closed Sun
  },
  {
    id: "rh-gallery",
    name: "RH Gallery",
    address: "310 Greenwich Ave",
    subLabel: "Lower-mid Ave, Havemeyer to Arch",
    blockId: "havemeyer__arch",
    hours: { open: 10, close: 18 }, // Mon-Sat 10a-6p, Sun 11a-6p
  },
  {
    id: "eastend",
    name: "Eastend",
    address: "409 Greenwich Ave",
    subLabel: "Bottom of the Ave, Arch to Railroad",
    blockId: "arch__railroad",
    hours: { open: 11, close: 23 }, // opens 11:30a; to 10p Mon-Wed, midnight Thu-Sat, 9p Sun
  },
];

export function hotspotById(id: string): Hotspot | null {
  return HOTSPOTS.find((h) => h.id === id) ?? null;
}
