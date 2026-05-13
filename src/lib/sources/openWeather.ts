import type {
  WeatherCondition,
  WeatherSnapshot,
} from "@/lib/model/types";
import { fetchWithTimeout } from "@/lib/utils/fetch";

// Weather source: Open-Meteo. No API key required, free for non-commercial.
// Swapped in for OpenWeather (which required a credit card on file for 3.0).
//
// Filename kept as openWeather.ts to match the PRD scaffold; if Phase 2
// wants to swap providers again the public functions are the seam.

const GREENWICH_LAT = 41.0262;
const GREENWICH_LON = -73.6282;
const REVALIDATE_SECONDS = 300; // 5min minimum cache per PRD.

const BASE = "https://api.open-meteo.com/v1/forecast";

type OpenMeteoResponse = {
  current?: {
    time: string;
    temperature_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: 0 | 1;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
    weather_code: number[];
  };
};

// WMO weather code → simplified bucket.
// Reference: https://open-meteo.com/en/docs (Weather variable docs).
function codeToCondition(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code <= 3) return "cloudy"; // 1-3: mainly clear / partly / overcast
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunderstorm";
  return "unknown";
}

function buildUrl(extraHourly = false): string {
  const params = new URLSearchParams({
    latitude: String(GREENWICH_LAT),
    longitude: String(GREENWICH_LON),
    current: "temperature_2m,precipitation,weather_code,wind_speed_10m,is_day",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "America/New_York",
  });
  if (extraHourly) {
    params.set("hourly", "temperature_2m,precipitation,weather_code");
    params.set("forecast_days", "7");
  }
  return `${BASE}?${params.toString()}`;
}

async function fetchOpenMeteo(extraHourly: boolean): Promise<OpenMeteoResponse> {
  const res = await fetchWithTimeout(buildUrl(extraHourly), {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`Open-Meteo ${res.status}`);
  }
  return (await res.json()) as OpenMeteoResponse;
}

export async function fetchGreenwichWeather(): Promise<WeatherSnapshot> {
  try {
    const data = await fetchOpenMeteo(false);
    const c = data.current;
    if (!c) {
      return emptyWeather();
    }
    return {
      tempF: c.temperature_2m,
      condition: codeToCondition(c.weather_code),
      precipitationIn: c.precipitation,
      windMph: c.wind_speed_10m,
      isDay: c.is_day === 1,
      fetchedAt: new Date().toISOString(),
      ok: true,
    };
  } catch (err) {
    console.warn("[openWeather] current fetch failed:", err);
    return emptyWeather();
  }
}

function emptyWeather(): WeatherSnapshot {
  return {
    tempF: 0,
    condition: "unknown",
    precipitationIn: 0,
    windMph: 0,
    isDay: true,
    fetchedAt: new Date().toISOString(),
    ok: false,
  };
}

export type HourlyForecastPoint = {
  timestamp: string;
  tempF: number;
  condition: WeatherCondition;
  precipitationIn: number;
};

export async function fetchGreenwichHourlyForecast(): Promise<HourlyForecastPoint[]> {
  try {
    const data = await fetchOpenMeteo(true);
    const h = data.hourly;
    if (!h) return [];
    return h.time.map((t, i) => ({
      timestamp: t,
      tempF: h.temperature_2m[i],
      condition: codeToCondition(h.weather_code[i]),
      precipitationIn: h.precipitation[i],
    }));
  } catch (err) {
    console.warn("[openWeather] hourly fetch failed:", err);
    return [];
  }
}

// Exported for tests.
export const __test__ = { codeToCondition, buildUrl };
