/**
 * SMHI Weather API integration (SNOW1gv1)
 * Free, no API key needed. Hourly forecasts for Stockholm.
 */

export interface HourlyWeather {
  time: string; // ISO 8601
  hour: number;
  temperature: number;
  cloudCover: number; // 0-8 oktas
  precipMm: number;
  windSpeed: number;
  symbolCode: number; // 1-27
}

export interface WeatherData {
  fetchedAt: string;
  hourly: Record<number, HourlyWeather>; // keyed by hour (0-23)
  today: HourlyWeather[];
}

// SMHI Wsymb2 symbol codes → readable info
const SYMBOL_MAP: Record<number, { label: string; icon: string; category: "clear" | "clouds" | "rain" | "snow" | "thunder" }> = {
  1:  { label: "Klart", icon: "☀️", category: "clear" },
  2:  { label: "Nästan klart", icon: "🌤️", category: "clear" },
  3:  { label: "Halvklart", icon: "⛅", category: "clouds" },
  4:  { label: "Molnigt", icon: "🌥️", category: "clouds" },
  5:  { label: "Mulet", icon: "☁️", category: "clouds" },
  6:  { label: "Mulet", icon: "☁️", category: "clouds" },
  7:  { label: "Dimma", icon: "🌫️", category: "clouds" },
  8:  { label: "Lätta regnskurar", icon: "🌦️", category: "rain" },
  9:  { label: "Regnskurar", icon: "🌧️", category: "rain" },
  10: { label: "Kraftiga regnskurar", icon: "🌧️", category: "rain" },
  11: { label: "Åskskurar", icon: "⛈️", category: "thunder" },
  12: { label: "Lätta snöblandade skurar", icon: "🌨️", category: "snow" },
  13: { label: "Snöblandade skurar", icon: "🌨️", category: "snow" },
  14: { label: "Kraftiga snöblandade skurar", icon: "🌨️", category: "snow" },
  15: { label: "Lätta snöskurar", icon: "🌨️", category: "snow" },
  16: { label: "Snöskurar", icon: "❄️", category: "snow" },
  17: { label: "Kraftiga snöskurar", icon: "❄️", category: "snow" },
  18: { label: "Lätt regn", icon: "🌧️", category: "rain" },
  19: { label: "Regn", icon: "🌧️", category: "rain" },
  20: { label: "Kraftigt regn", icon: "🌧️", category: "rain" },
  21: { label: "Åska", icon: "⛈️", category: "thunder" },
  22: { label: "Lätt snöblandat regn", icon: "🌨️", category: "snow" },
  23: { label: "Snöblandat regn", icon: "🌨️", category: "snow" },
  24: { label: "Kraftigt snöblandat regn", icon: "🌨️", category: "snow" },
  25: { label: "Lätt snöfall", icon: "🌨️", category: "snow" },
  26: { label: "Snöfall", icon: "❄️", category: "snow" },
  27: { label: "Kraftigt snöfall", icon: "❄️", category: "snow" },
};

export function getSymbolInfo(code: number) {
  return SYMBOL_MAP[code] ?? { label: "Okänt", icon: "❓", category: "clouds" as const };
}

/** Is there actual sunshine given weather? */
export function hasSunshine(symbolCode: number): boolean {
  return symbolCode <= 2; // Only clear or nearly clear = actual sun
}

/** Descriptive text combining shadow data with weather */
export function getCombinedStatus(
  shadowStatus: string,
  symbolCode: number | undefined
): { label: string; color: string } {
  const isSunShadow = shadowStatus === "sun" || shadowStatus === "s";

  if (!symbolCode) {
    return isSunShadow
      ? { label: "Sol (ingen väderdata)", color: "#f59e0b" }
      : { label: "Skugga", color: "#64748b" };
  }

  const symbol = getSymbolInfo(symbolCode);

  if (symbol.category === "rain" || symbol.category === "thunder") {
    return { label: symbol.label, color: "#3b82f6" };
  }

  if (symbol.category === "snow") {
    return { label: symbol.label, color: "#8b5cf6" };
  }

  if (isSunShadow && symbolCode <= 2) {
    return { label: "Sol!", color: "#f59e0b" };
  }

  if (isSunShadow && symbolCode <= 4) {
    return { label: "Sol med moln", color: "#fb923c" };
  }

  if (isSunShadow && symbolCode >= 5) {
    return { label: "Mulet (sol bakom moln)", color: "#94a3b8" };
  }

  // In shadow
  if (symbolCode <= 2) {
    return { label: "Skugga (klart väder)", color: "#64748b" };
  }

  return { label: "Skugga & moln", color: "#475569" };
}

// Stockholm center coordinates for SMHI
const STOCKHOLM_LAT = 59.33;
const STOCKHOLM_LON = 18.07;
const SMHI_URL = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${STOCKHOLM_LON}/lat/${STOCKHOLM_LAT}/data.json`;

const CACHE_KEY = "soldryck_weather";
const CACHE_TTL = 30 * 60 * 1000; // 30 min

export async function fetchWeather(): Promise<WeatherData | null> {
  // Check cache
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as WeatherData;
      const age = Date.now() - new Date(parsed.fetchedAt).getTime();
      if (age < CACHE_TTL) return parsed;
    }
  }

  try {
    const res = await fetch(SMHI_URL);
    if (!res.ok) return null;

    const raw = await res.json();
    const timeSeries = raw.timeSeries || [];

    const hourly: Record<number, HourlyWeather> = {};
    const today: HourlyWeather[] = [];
    const nowDate = new Date().toISOString().slice(0, 10);

    for (const entry of timeSeries) {
      const time = entry.time as string;
      const d = entry.data as Record<string, number>;
      const date = new Date(time);
      const hour = date.getHours();

      const hw: HourlyWeather = {
        time,
        hour,
        temperature: d.air_temperature ?? 0,
        cloudCover: d.cloud_area_fraction ?? 0,
        precipMm: d.precipitation_amount_mean ?? 0,
        windSpeed: d.wind_speed ?? 0,
        symbolCode: d.symbol_code ?? 1,
      };

      // Store today's data keyed by hour
      const entryDate = time.slice(0, 10);
      if (entryDate === nowDate || Object.keys(hourly).length < 24) {
        hourly[hour] = hw;
        today.push(hw);
      }
    }

    const result: WeatherData = {
      fetchedAt: new Date().toISOString(),
      hourly,
      today,
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    }

    return result;
  } catch (e) {
    console.error("Weather fetch failed:", e);
    return null;
  }
}
