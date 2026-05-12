import type {
  Confidence,
  DemandCategory,
  DemandScore,
  HolidayKind,
  ModelInput,
  TimeFeatures,
  TrafficSnapshot,
  WeatherSnapshot,
} from "./types";
import { getPrior } from "./priors";

// Phase 1 heuristic. Pure function. Replaced wholesale in Phase 2 by a
// trained model that consumes the same ModelInput shape.
//
// Formula (additive, then closure-day cap, then clamp to [0,100]):
//   raw = base_by_hour_dow + weatherMod + trafficMod
//                          + holidayMod + schoolMod + eventMod
//   if holidayKind == "closure": raw = min(raw, 20)
//   score = clamp(round(raw), 0, 100)
//
// Modifier sizing rationale follows the PRD bullets:
//   "Rain reduces 15-25 points"      → rain = -20
//   "Snow reduces 30-50 points"      → snow = -40
//   "80°F+ sunny day boosts 10"      → +10 in that exact band
// Holiday "closure" is treated as a hard cap rather than a -50 additive,
// because on Christmas Day the Saturday-noon baseline (95) plus a -50 mod
// still lands at 45 (yellow), which would be flatly wrong — the Ave is dead.

export function weatherModifier(weather: WeatherSnapshot): number {
  if (!weather.ok || weather.condition === "unknown") return 0;
  switch (weather.condition) {
    case "snow":
      return -40;
    case "thunderstorm":
      return -30;
    case "rain":
      return -20;
    case "fog":
      return -5;
    case "clear":
    case "cloudy": {
      let mod = 0;
      if (weather.isDay && weather.tempF >= 80) mod += 10;
      else if (weather.isDay && weather.tempF >= 65) mod += 5;
      if (weather.tempF < 32) mod -= 10;
      return mod;
    }
    default:
      return 0;
  }
}

export function trafficModifier(traffic: TrafficSnapshot): number {
  if (!traffic.ok) return 0;
  let mod = 0;
  switch (traffic.severity) {
    case "light":
      mod += 2;
      break;
    case "moderate":
      mod += 5;
      break;
    case "heavy":
      mod += 8;
      break;
  }
  if (traffic.closureNearby) mod -= 5;
  return mod;
}

export function holidayModifier(kind: HolidayKind): number {
  switch (kind) {
    case "retail-spike":
      return 15;
    case "observed":
      return 3;
    case "closure":
      return 0; // handled by hard cap, not additive
    case "none":
    default:
      return 0;
  }
}

export function schoolModifier(time: TimeFeatures): number {
  // Weekends/holidays absorb school signal through other modifiers.
  if (time.isWeekend || time.isHoliday) return 0;
  const { allInSession, anyInSession } = time.schoolStatus;
  if (allInSession) return 0; // baseline
  if (anyInSession) return 3; // one cohort out of school, adults still around
  return 5; // summer/all-break weekday: locals around more during daytime
}

function categorize(score: number): DemandCategory {
  if (score <= 40) return "green";
  if (score <= 70) return "yellow";
  return "red";
}

function confidenceFrom(weather: WeatherSnapshot, traffic: TrafficSnapshot): Confidence {
  if (weather.ok && traffic.ok) return "high";
  if (weather.ok || traffic.ok) return "medium";
  return "low";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeDemand(input: ModelInput): DemandScore {
  const { weather, traffic, time, specialEvent } = input;

  const base = getPrior(time.dayOfWeek, time.hour);
  const weatherMod = weatherModifier(weather);
  const trafficMod = trafficModifier(traffic);
  const holidayMod = holidayModifier(time.holidayKind);
  const schoolMod = schoolModifier(time);
  const eventMod = specialEvent?.demandBoost ?? 0;

  const rawSum = base + weatherMod + trafficMod + holidayMod + schoolMod + eventMod;
  let raw = rawSum;
  const closureCapped = time.holidayKind === "closure";
  if (closureCapped) {
    raw = Math.min(raw, 20);
  }

  const score = clamp(Math.round(raw), 0, 100);

  return {
    score,
    category: categorize(score),
    confidence: confidenceFrom(weather, traffic),
    breakdown: {
      base,
      weatherMod,
      trafficMod,
      holidayMod,
      schoolMod,
      eventMod,
      rawSum,
      closureCapped,
    },
  };
}
