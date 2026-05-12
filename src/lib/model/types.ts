export type DemandCategory = "green" | "yellow" | "red";
export type Confidence = "low" | "medium" | "high";

export type DemandScore = {
  score: number;
  category: DemandCategory;
  confidence: Confidence;
};

export type WeatherSnapshot = {
  temp: number;
  condition: string;
  precipitation: number;
};

export type TrafficSnapshot = {
  i95SpeedNb: number | null;
  i95SpeedSb: number | null;
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
