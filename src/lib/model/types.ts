export type DemandCategory = "green" | "yellow" | "red";
export type Confidence = "low" | "medium" | "high";

export type DemandScore = {
  score: number;
  category: DemandCategory;
  confidence: Confidence;
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
};

export type HolidayKind = "closure" | "retail-spike" | "observed" | "none";

export type TimeFeatures = {
  hour: number; // 0-23, America/New_York local
  dayOfWeek: number; // 0=Sun..6=Sat, America/New_York local
  isWeekend: boolean;
  isHoliday: boolean;
  holidayKind: HolidayKind;
  holidayName: string | null;
  isSchoolInSession: boolean;
  localDate: string; // YYYY-MM-DD in America/New_York
};

export type SpecialEvent = {
  date: string; // YYYY-MM-DD
  name: string;
  demandBoost: number; // +/- adjustment to score
};

export type ModelInput = {
  weather: WeatherSnapshot;
  traffic: TrafficSnapshot;
  time: TimeFeatures;
};
