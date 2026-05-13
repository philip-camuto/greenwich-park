import { BLOCKS } from "@/components/avenue-map-data";
import type { DemandCategory } from "@/lib/model/types";

type BlockKind = "retail" | "restaurant" | "errand" | "mixed";

export type BlockProfile = {
  blockId: string;
  label: string;
  capacity: "low" | "medium" | "high";
  relief: "low" | "medium" | "high";
  kind: BlockKind;
  anchors: string[];
  anchorMod: number;
};

export type BlockContext = {
  hour: number;
  dayOfWeek: number;
};

export type PerBlockScore = {
  score: number;
  category: DemandCategory;
  modifier: number;
  reasons: string[];
};

// Address-verified anchor placements (May 2026). Greenwich Ave addresses
// INCREASE going south: 1 starts at the Putnam Ave end (top), 400+ ends at
// Steamboat Rd / Railroad Ave (bottom, by the train station).
//   The Ginger Man      64 Greenwich Ave  → lafayette__elm   (top)
//   Sephora             75                → elm__lewis
//   CVS                 99                → elm__lewis
//   Tiffany & Co.      140                → elm__lewis
//   Lululemon          151                → lewis__mason
//   Saks Fifth Avenue  205                → lewis__mason
//   Betteridge         239                → mason__havemeyer
//   RH Outdoor         264                → mason__havemeyer
//   RH Estates         265 (spring 2026)  → mason__havemeyer
//   RH Gallery         310 (Historic Post Office at Havemeyer Pl) → havemeyer__arch
//   Apple              356                → arch__railroad
//   Theory             396                → arch__railroad
// Plus: Greenwich train station sits immediately south of arch__railroad
// and pulls commuters into its own lots, dampening parking demand on that
// southernmost block at rush hours.
export const blockProfiles: Record<string, BlockProfile> = {
  lafayette__elm: {
    blockId: "lafayette__elm",
    label: "Lafayette / Putnam to Elm",
    capacity: "medium",
    relief: "medium",
    kind: "restaurant",
    anchors: ["The Ginger Man", "upper Ave restaurants"],
    anchorMod: 4,
  },
  elm__lewis: {
    blockId: "elm__lewis",
    label: "Elm to Lewis",
    capacity: "high",
    relief: "high",
    kind: "retail",
    anchors: ["Tiffany", "Sephora", "CVS"],
    anchorMod: 5,
  },
  lewis__mason: {
    blockId: "lewis__mason",
    label: "Lewis to Mason / Bolling",
    capacity: "low",
    relief: "medium",
    kind: "retail",
    anchors: ["Saks Fifth Avenue", "Lululemon"],
    anchorMod: 7,
  },
  mason__havemeyer: {
    blockId: "mason__havemeyer",
    label: "Mason / Bolling to Havemeyer",
    capacity: "medium",
    relief: "medium",
    kind: "retail",
    anchors: ["RH Outdoor", "RH Estates", "Betteridge"],
    anchorMod: 6,
  },
  havemeyer__arch: {
    blockId: "havemeyer__arch",
    label: "Havemeyer to Arch",
    capacity: "medium",
    relief: "low",
    kind: "retail",
    anchors: ["RH Gallery (Historic Post Office)"],
    anchorMod: 6,
  },
  arch__railroad: {
    blockId: "arch__railroad",
    label: "Arch to Railroad",
    // Two competing forces: Apple is a flagship that pulls hard (Genius Bar
    // bookings, weekend traffic) AND the train station next door siphons
    // commuter parking into the station lots. Net: medium capacity, low
    // relief (limited side streets between Arch and the station), and a
    // healthy anchor pull from the Apple flagship + Theory.
    capacity: "medium",
    relief: "low",
    kind: "retail",
    anchors: ["Apple", "Theory"],
    anchorMod: 6,
  },
};

function categorize(score: number): DemandCategory {
  if (score <= 40) return "green";
  if (score <= 70) return "yellow";
  return "red";
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function capacityMod(capacity: BlockProfile["capacity"]): number {
  if (capacity === "low") return 5;
  if (capacity === "high") return -3;
  return 0;
}

function reliefMod(relief: BlockProfile["relief"]): number {
  if (relief === "low") return 3;
  if (relief === "high") return -4;
  return 0;
}

function timeMod(kind: BlockKind, ctx: BlockContext): number {
  const weekend = ctx.dayOfWeek === 0 || ctx.dayOfWeek === 6;
  const lunch = ctx.hour >= 11 && ctx.hour <= 14;
  const dinner = ctx.hour >= 17 && ctx.hour <= 21;
  const retailPeak = ctx.hour >= 11 && ctx.hour <= 17;

  if (kind === "restaurant" && dinner) return 7;
  if (kind === "restaurant" && lunch) return 4;
  if (kind === "retail" && retailPeak) return weekend ? 7 : 4;
  if (kind === "errand" && ctx.hour >= 10 && ctx.hour <= 16) return 2;
  return 0;
}

export function scoreBlock(
  globalScore: number,
  profile: BlockProfile,
  ctx: BlockContext,
): PerBlockScore {
  const parts = {
    capacity: capacityMod(profile.capacity),
    relief: reliefMod(profile.relief),
    time: timeMod(profile.kind, ctx),
    anchor: profile.anchorMod,
  };
  const modifier = parts.capacity + parts.relief + parts.time + parts.anchor;
  const score = clampScore(globalScore + modifier);
  const reasons = [
    `${profile.anchors.join(" + ")} anchor demand`,
    profile.capacity === "low"
      ? "fewer curb spaces"
      : profile.capacity === "high"
        ? "more curb capacity"
        : "normal curb capacity",
    profile.relief === "high"
      ? "better side-street relief"
      : profile.relief === "low"
        ? "limited side-street relief"
        : "some side-street relief",
  ];
  if (parts.time > 0) {
    reasons.push(
      profile.kind === "restaurant"
        ? "lunch/dinner timing"
        : profile.kind === "retail"
          ? "shopping-window timing"
          : "errand-window timing",
    );
  }

  return { score, category: categorize(score), modifier, reasons };
}

export function perBlockScores(
  globalScore: number,
  ctx: BlockContext = { hour: new Date().getHours(), dayOfWeek: new Date().getDay() },
): Record<string, PerBlockScore> {
  const out: Record<string, PerBlockScore> = {};
  for (const b of BLOCKS) {
    const profile = blockProfiles[b.id];
    out[b.id] = profile
      ? scoreBlock(globalScore, profile, ctx)
      : { score: clampScore(globalScore), category: categorize(globalScore), modifier: 0, reasons: [b.label] };
  }
  return out;
}
