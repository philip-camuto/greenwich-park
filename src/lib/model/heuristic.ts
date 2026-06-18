import type {
  Confidence,
  DemandCategory,
  DemandScore,
  HolidayKind,
  MetroNorthAlertsInput,
  MetroNorthInput,
  ModelInput,
  TimeFeatures,
  TrafficSnapshot,
  WeatherSnapshot,
} from "./types";
import { getPrior } from "./priors";
import { MODEL_BLEND_ALPHA, trainedBaseScore } from "./trained";

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
  let mod = 0;
  switch (weather.condition) {
    case "snow":
      mod -= 40;
      break;
    case "thunderstorm":
      mod -= 30;
      break;
    case "rain":
      mod -= 20;
      break;
    case "fog":
      mod -= 5;
      break;
    case "clear":
    case "cloudy":
      if (weather.isDay && weather.tempF >= 80) mod += 10;
      else if (weather.isDay && weather.tempF >= 65) mod += 5;
      break;
  }
  // Freezing temperature compounds regardless of condition. Bitterly cold
  // snow is worse than 33F slush; freezing rain worse than warm rain.
  if (weather.tempF < 32) mod -= 10;
  return mod;
}

// I-95 congestion is a weak predictor of downtown-Ave retail parking: Ave
// parkers are local shoppers/diners, not highway through-drivers. The only
// plausible link is commuter mode-switching during rush, and even that is
// small — so the congestion bump is demoted (was +8) and gated to rush hours.
// A nearby road closure cuts demand regardless of hour (harder to reach the
// Ave). `hour` is local hour-of-day; omitted ⇒ treat as in-window (unit tests).
function isRushHour(hour: number): boolean {
  return (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
}

export function trafficModifier(
  traffic: TrafficSnapshot,
  hour?: number,
): number {
  // Future-day projections are a synthetic hour-of-day curve shown for context
  // only. The base demand surface already encodes hour-of-day, so scoring the
  // projection would double-count it. Display the reason, contribute nothing.
  if (traffic.projected) return 0;
  const inRush = hour == null ? true : isRushHour(hour);
  // Prefer TomTom live speed ratio when available; fall back to CT 511 events.
  if (traffic.tomTomOk && typeof traffic.speedRatio === "number") {
    let mod = 0;
    if (inRush) {
      if (traffic.speedRatio < 0.4) mod += 2;
      else if (traffic.speedRatio < 0.6) mod += 1;
    }
    if (traffic.roadClosure) mod -= 5;
    return mod;
  }
  // Fallback: existing CT 511 event-count logic
  if (!traffic.ok) return 0;
  let mod = 0;
  if (inRush) {
    switch (traffic.severity) {
      case "heavy":
        mod += 2;
        break;
      case "moderate":
        mod += 1;
        break;
      // "light" no longer nudges — below the noise floor for retail parking.
    }
  }
  if (traffic.closureNearby) mod -= 5;
  return mod;
}

export function metroNorthModifier(
  mn: MetroNorthInput | null | undefined,
): number {
  if (!mn || !mn.ok || mn.vsBaseline == null) return 0;
  // ±4, not ±8: this is systemwide MNR ridership (all three lines), a coarse
  // proxy only loosely linked to who parks on the Ave. No finer public data
  // exists, so keep it but don't let it swing the score like a local signal.
  if (mn.vsBaseline > 1.1) return -4;   // more train commuters → fewer drivers
  if (mn.vsBaseline < 0.8) return 4;    // fewer train commuters → more drivers
  return 0;
}

export function metroNorthAlertsModifier(
  alerts: MetroNorthAlertsInput | null | undefined,
): number {
  // Trains down → commuters drive instead → demand on the Ave goes UP.
  // Sized to match weather: weekday rush flipping car-mode is a real bump,
  // but not as big as a snowstorm. Major delay/suspension is the headline
  // signal here; minor delays nudge.
  if (!alerts || !alerts.ok) return 0;
  switch (alerts.newHavenLineStatus) {
    case "suspended":
      return 10;
    case "major-delays":
      return 8;
    case "minor-delays":
      return 3;
    case "planned-work":
    case "normal":
    case "unknown":
    default:
      return 0;
  }
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
  const { weather, traffic, time } = input;

  // In the enforcement window the demand base is the CV-tuned blend of the
  // trained surface and the hand prior (MODEL_BLEND_ALPHA on the model, the
  // rest on the prior). Outside it (no citation signal) the prior is the sole
  // base. Weather is layered on identically either way (the model excludes
  // weather). NOTE: at alpha=0.95 the prior's in-window contribution is a
  // ~1-point nudge, so the recalibrated in-window cells in priors.ts barely
  // move scores here — the trained surface dominates. priors.ts changes are
  // load-bearing only OUTSIDE the window. See trained.ts / cv_report.json.
  const prior = getPrior(time.dayOfWeek, time.hour);
  const trainedBase = trainedBaseScore(time.dayOfWeek, time.hour);
  const base =
    trainedBase != null
      ? Math.round(MODEL_BLEND_ALPHA * trainedBase + (1 - MODEL_BLEND_ALPHA) * prior)
      : prior;
  const baseSource: "blend" | "prior" = trainedBase != null ? "blend" : "prior";
  const weatherMod = weatherModifier(weather);
  const trafficMod = trafficModifier(traffic, time.hour);
  const holidayMod = holidayModifier(time.holidayKind);
  const schoolMod = schoolModifier(time);

  let eventMod = 0;
  if (input.specialEvents && input.specialEvents.length > 0) {
    for (const e of input.specialEvents) {
      eventMod += e.demandBoost;
    }
    eventMod = Math.min(eventMod, 20);  // cap stacking
  } else if (input.specialEvent) {
    eventMod = input.specialEvent.demandBoost;
  }

  const metroNorthMod = metroNorthModifier(input.metroNorth);
  const metroNorthAlertsMod = metroNorthAlertsModifier(input.metroNorthAlerts);

  const rawSum =
    base +
    weatherMod +
    trafficMod +
    holidayMod +
    schoolMod +
    eventMod +
    metroNorthMod +
    metroNorthAlertsMod;
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
      baseSource,
      weatherMod,
      trafficMod,
      holidayMod,
      schoolMod,
      eventMod,
      metroNorthMod,
      metroNorthAlertsMod,
      rawSum,
      closureCapped,
    },
  };
}
