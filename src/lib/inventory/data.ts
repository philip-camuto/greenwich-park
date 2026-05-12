// Structured downtown Greenwich parking inventory.
//
// Estimates derived from satellite imagery on 2026-05-12. NONE of these
// counts are measured — they're best-effort guesses for now, pending FOIA
// verification with Greenwich Parking Services. The point of building this
// out today is:
//   - the UI can show approximate downtown coverage ("about 730 spots")
//   - the Drizzle schema (observations_by_zone) is ready to receive Phase 3
//     citation density + Phase 4 camera occupancy data at the zone level
//   - we can break predictions down by zone (on-Ave vs rear lots) once we
//     have ground truth
//
// Numbers should be replaced with measured values once Greenwich Parking
// Services confirms or once camera/citation data is in hand. Bump
// SOURCE_DATE when that happens.

export type ZoneType = "ave_street" | "side_street" | "off_ave_lot";

export type ParkingZone = {
  id: string;
  section: number;
  name: string;
  type: ZoneType;
  estimatedSpaces: number;
  notes?: string;
};

export const PARKING_ZONES: ParkingZone[] = [
  {
    id: "ave-1-north",
    section: 1,
    name: "North Greenwich Ave (Blo Blow Dry, TD Bank, Granola Bar, Cottage, Citizens)",
    type: "ave_street",
    estimatedSpaces: 45,
  },
  {
    id: "ave-2",
    section: 2,
    name: "Greenwich Ave (Bestever Cleaners, CVS, Sephora, Maman, CFCF Coffee)",
    type: "ave_street",
    estimatedSpaces: 38,
  },
  {
    id: "ave-3",
    section: 3,
    name: "Greenwich Ave (Saks, Posh Nails, Elm St Oyster House)",
    type: "ave_street",
    estimatedSpaces: 30,
  },
  {
    id: "ave-4-central",
    section: 4,
    name: "Central Greenwich Ave (MOLI, Bank of America)",
    type: "ave_street",
    estimatedSpaces: 32,
  },
  {
    id: "ave-5",
    section: 5,
    name: "Greenwich Ave (Gregorys, Apple, Richards, Bistro V, Punch Fitness)",
    type: "ave_street",
    estimatedSpaces: 44,
  },
  {
    id: "ave-6",
    section: 6,
    name: "Greenwich Ave (Hinoki, SoulCycle, Eastend, Mediterraneo)",
    type: "ave_street",
    estimatedSpaces: 42,
  },
  {
    id: "side-streets",
    section: 7,
    name: "Side streets feeding Greenwich Ave (Elm, Lewis, Bruce Park)",
    type: "side_street",
    estimatedSpaces: 55,
  },
  {
    id: "lot-cvs-usps",
    section: 8,
    name: "Rear lot near CVS, USPS, Le Penguin (Mason St side)",
    type: "off_ave_lot",
    estimatedSpaces: 58,
  },
  {
    id: "lot-benedict-lewis",
    section: 9,
    name: "Benedict Place / Lewis Street municipal lot",
    type: "off_ave_lot",
    estimatedSpaces: 145,
  },
  {
    id: "lot-saks-fieldpoint",
    section: 10,
    name: "Saks / Posh Nails / Fieldpoint Private / Mason St rear lots",
    type: "off_ave_lot",
    estimatedSpaces: 115,
  },
  {
    id: "lot-happy-monkey",
    section: 11,
    name: "Rear lots near Happy Monkey / Jean-Georges / Eastend",
    type: "off_ave_lot",
    estimatedSpaces: 60,
  },
  {
    id: "lot-central-east",
    section: 12,
    name: "Rear lots behind MOLI / Core Burn / Charles Hilton",
    type: "off_ave_lot",
    estimatedSpaces: 65,
  },
];

export const INVENTORY_SOURCE_DATE = "2026-05-12";
export const INVENTORY_NOTE =
  "Estimated from satellite imagery, pending FOIA verification with Greenwich Parking Services.";

// Derived totals -- single source of truth is PARKING_ZONES; these compute.
export function getZonesByType(type: ZoneType): ParkingZone[] {
  return PARKING_ZONES.filter((z) => z.type === type);
}

export function getTotalByType(type: ZoneType): number {
  return getZonesByType(type).reduce((sum, z) => sum + z.estimatedSpaces, 0);
}

export function getZoneById(id: string): ParkingZone | null {
  return PARKING_ZONES.find((z) => z.id === id) ?? null;
}

export const INVENTORY_TOTALS = {
  aveStreet: getTotalByType("ave_street"),
  sideStreet: getTotalByType("side_street"),
  offAveLots: getTotalByType("off_ave_lot"),
  get total(): number {
    return this.aveStreet + this.sideStreet + this.offAveLots;
  },
  source: `${INVENTORY_NOTE} (${INVENTORY_SOURCE_DATE})`,
};
