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

export type TimeFeatures = {
  hour: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isHoliday: boolean;
};

export type ModelInput = {
  weather: WeatherSnapshot;
  traffic: TrafficSnapshot;
  time: TimeFeatures;
};
