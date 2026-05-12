import type { WeatherSnapshot } from "@/lib/model/types";

// OpenWeather One Call 3.0. Greenwich CT lat/lng: 41.0262, -73.6282.
export async function fetchGreenwichWeather(): Promise<WeatherSnapshot> {
  // TODO Step 2: current conditions.
  return { temp: 0, condition: "unknown", precipitation: 0 };
}

export type HourlyForecastPoint = {
  timestamp: number;
  temp: number;
  condition: string;
  precipitation: number;
};

export async function fetchGreenwichHourlyForecast(): Promise<HourlyForecastPoint[]> {
  // TODO Step 2: 48h hourly forecast.
  return [];
}
