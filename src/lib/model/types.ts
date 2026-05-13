export type DemandCategory = "green" | "yellow" | "red";
export type Confidence = "low" | "medium" | "high";

export type DemandScore = {
  score: number;
  category: DemandCategory;
  confidence: Confidence;
  breakdown: ScoreBreakdown;
};

export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "fog"
  | "unknown";

export type WeatherSnapshot = {
  tempF: number;
  condition: WeatherCondition;
  precipitationIn: number;
  windMph: number;
  isDay: boolean;
  fetchedAt: string;
  ok: boolean; // false on upstream error / missing data
};

export type TrafficSeverity = "none" | "light" | "moderate" | "heavy";

export type TrafficSnapshot = {
  severity: TrafficSeverity;
  greenwichRelevantEvents: number;
  i95EventsTotal: number;
  northboundAffected: boolean;
  southboundAffected: boolean;
  closureNearby: boolean;
  fetchedAt: string;
  ok: boolean; // false on upstream error / missing key
  // NEW TomTom fields (all optional for backward compat):
  currentSpeedMph?: number | null;
  freeFlowSpeedMph?: number | null;
  speedRatio?: number | null;
  roadClosure?: boolean;
  tomTomOk?: boolean;
};

export type HolidayKind = "closure" | "retail-spike" | "observed" | "none";

// Greenwich has two distinct school worlds with non-overlapping calendars:
//   public  = Greenwich Public Schools (GPS)
//   private = Brunswick, Greenwich Country Day, Greenwich Academy, etc.
// They diverge most on (1) the private 2-week spring break in early/mid March,
// (2) private year ending ~3 weeks before public in late May/early June, and
// (3) private winter break running a few days longer on each side.
export type SchoolStatus = {
  publicInSession: boolean;
  privateInSession: boolean;
  anyInSession: boolean;
  allInSession: boolean;
};

export type TimeFeatures = {
  hour: number; // 0-23, America/New_York local
  dayOfWeek: number; // 0=Sun..6=Sat, America/New_York local
  isWeekend: boolean;
  isHoliday: boolean;
  holidayKind: HolidayKind;
  holidayName: string | null;
  schoolStatus: SchoolStatus;
  isSchoolInSession: boolean; // mirrors schoolStatus.allInSession (PRD field name)
  localDate: string; // YYYY-MM-DD in America/New_York
};

export type SpecialEvent = {
  date: string; // YYYY-MM-DD
  name: string;
  demandBoost: number; // +/- adjustment to score
  startsAt?: string; // ISO 8601 UTC
  source?: "eventbrite" | "ticketmaster" | "town-ical" | "manual";
  url?: string;
};

export type MetroNorthInput = {
  ridership: number | null;
  vsBaseline: number | null;
  ok: boolean;
};

export type ScoreBreakdown = {
  base: number;
  weatherMod: number;
  trafficMod: number;
  holidayMod: number;
  schoolMod: number;
  eventMod: number;
  metroNorthMod: number; // NEW
  rawSum: number;
  closureCapped: boolean;
};

export type ModelInput = {
  weather: WeatherSnapshot;
  traffic: TrafficSnapshot;
  time: TimeFeatures;
  specialEvent?: SpecialEvent | null;    // existing — keep for back-compat
  specialEvents?: SpecialEvent[];        // NEW — preferred when multiple events fire
  metroNorth?: MetroNorthInput | null;   // NEW
};
