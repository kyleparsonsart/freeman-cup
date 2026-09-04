/**
 * Hourly forecast for the window of play, from Open-Meteo (free, no key,
 * browser calls allowed). Sand Valley, Nekoosa WI.
 */
const LAT = 44.30, LON = -89.93;
const TZ = 'America/Chicago';

export interface WxHour {
  iso: string;        // '2026-10-08T08:00'
  hour: number;       // 0-23 course-local
  temp: number;       // °F
  wind: number;       // mph
  dir: string;        // 'NW'
  pop: number;        // precipitation probability %
  icon: 'sun' | 'part' | 'cloud' | 'rain';
}

interface OpenMeteo {
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    weather_code: number[];
  };
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const dirOf = (deg: number) => DIRS[Math.round(deg / 45) % 8];
const iconOf = (code: number, pop: number): WxHour['icon'] =>
  code >= 51 || pop >= 50 ? 'rain' : code >= 3 ? 'cloud' : code >= 1 ? 'part' : 'sun';

let cache: { at: number; hours: WxHour[] } | null = null;

/** every forecast hour we can get (about 7 days), cached for 30 minutes */
export async function fetchHours(): Promise<WxHour[]> {
  if (cache && Date.now() - cache.at < 30 * 60 * 1000) return cache.hours;
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${LAT}&longitude=${LON}&timezone=${encodeURIComponent(TZ)}`
    + '&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code'
    + '&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=7&past_days=1';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const j = (await res.json()) as OpenMeteo;
  const h = j.hourly;
  const hours: WxHour[] = h.time.map((t, i) => ({
    iso: t,
    hour: Number(t.slice(11, 13)),
    temp: Math.round(h.temperature_2m[i]),
    wind: Math.round(h.wind_speed_10m[i]),
    dir: dirOf(h.wind_direction_10m[i]),
    pop: h.precipitation_probability[i] ?? 0,
    icon: iconOf(h.weather_code[i], h.precipitation_probability[i] ?? 0),
  }));
  cache = { at: Date.now(), hours };
  return hours;
}

/** the hours of one day's window: from the first tee, `span` hours */
export function windowFor(hours: WxHour[], date: string, teeTime: string, span: number): WxHour[] {
  const start = Number(teeTime.slice(0, 2));
  return hours.filter(x => x.iso.startsWith(date) && x.hour >= start && x.hour <= start + span);
}

/** 18 holes is about five hours; 12 is about three */
export const spanFor = (holes: number): number => Math.max(2, Math.round(holes / 18 * 5));

export const hourLabel = (h: number): string => `${((h + 11) % 12) + 1}${h >= 12 ? 'P' : 'A'}`;
