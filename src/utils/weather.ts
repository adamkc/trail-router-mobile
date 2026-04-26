/**
 * Sunrise/sunset (computed locally via NOAA's solar formulas) + current
 * weather (from Open-Meteo's free Forecast API). No API key required.
 *
 * Both are anchored to a [lng, lat] coord — we pass the active project's
 * center so the home screen's "DAYLIGHT 6h 12m" line is accurate to the
 * trail area, not the user's device location (which they may not have
 * granted permission to share).
 */

export interface DaylightInfo {
  /** Sunrise time, local clock — "6:32" or null if outside calc range. */
  sunrise: string | null;
  sunset: string | null;
  /** Daylight duration ("11h 14m") or null when polar day/night. */
  daylight: string | null;
}

export interface WeatherInfo {
  /** Temperature in °C (rounded). */
  tempC: number | null;
  /** Wind speed in km/h (rounded). */
  windKph: number | null;
  /** Compass bearing direction (e.g., "SW") for the wind. */
  windDir: string | null;
}

const COMPASS = ['N','NE','E','SE','S','SW','W','NW'];
function bearingToCardinal(deg: number): string {
  const i = Math.round(((deg % 360 + 360) % 360) / 45) % 8;
  return COMPASS[i];
}

/** NOAA solar approximation. Returns sunrise/sunset/daylight at the given
 *  [lng, lat] for the local day (the device's timezone offset is applied). */
export function computeDaylight(coord: [number, number], date = new Date()): DaylightInfo {
  const [lng, lat] = coord;
  // Day of year (1-366) at noon local.
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000);
  // Fractional year in radians.
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (12 - 12) / 24);
  // Equation of time (minutes).
  const eqTime = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma)
  );
  // Solar declination (radians).
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148  * Math.sin(3 * gamma);
  // Solar hour angle (degrees) for sunrise/sunset (zenith 90.833° — standard).
  const latRad = (lat * Math.PI) / 180;
  const cosHa = (Math.cos((90.833 * Math.PI) / 180) - Math.sin(latRad) * Math.sin(decl)) /
    (Math.cos(latRad) * Math.cos(decl));
  if (cosHa > 1)  return { sunrise: null, sunset: null, daylight: 'Polar night' };
  if (cosHa < -1) return { sunrise: null, sunset: null, daylight: 'Polar day'   };
  const ha = (Math.acos(cosHa) * 180) / Math.PI;
  // Sunrise/sunset in minutes UTC.
  const noonMinUtc = 720 - 4 * lng - eqTime;
  const sunriseMinUtc = noonMinUtc - 4 * ha;
  const sunsetMinUtc  = noonMinUtc + 4 * ha;
  // Convert to local clock by applying the device's tz offset (minutes east of UTC).
  const tzOffsetMin = -date.getTimezoneOffset();
  const fmt = (minUtc: number): string => {
    let total = minUtc + tzOffsetMin;
    while (total < 0)     total += 1440;
    while (total > 1440)  total -= 1440;
    const h = Math.floor(total / 60);
    const m = Math.round(total % 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };
  const sunrise = fmt(sunriseMinUtc);
  const sunset  = fmt(sunsetMinUtc);
  const dayMin = Math.max(0, sunsetMinUtc - sunriseMinUtc);
  const daylight = `${Math.floor(dayMin / 60)}h ${String(Math.round(dayMin % 60)).padStart(2, '0')}m`;
  return { sunrise, sunset, daylight };
}

/** Fetch current temperature + wind for the given coord. Returns null fields
 *  on any network/API failure so callers can render dashes. */
export async function fetchCurrentWeather(
  coord: [number, number],
  signal?: AbortSignal,
): Promise<WeatherInfo> {
  const fallback: WeatherInfo = { tempC: null, windKph: null, windDir: null };
  try {
    const [lng, lat] = coord;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,wind_speed_10m,wind_direction_10m`;
    const res = await fetch(url, { signal });
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        wind_speed_10m?: number;
        wind_direction_10m?: number;
      };
    };
    const c = json.current ?? {};
    return {
      tempC: typeof c.temperature_2m === 'number' ? Math.round(c.temperature_2m) : null,
      windKph: typeof c.wind_speed_10m === 'number' ? Math.round(c.wind_speed_10m) : null,
      windDir: typeof c.wind_direction_10m === 'number' ? bearingToCardinal(c.wind_direction_10m) : null,
    };
  } catch {
    return fallback;
  }
}
