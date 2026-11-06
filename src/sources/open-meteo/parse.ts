// PRECOG / Trend Radar · Open-Meteo: reading forecast and air-quality replies (weather, sun, soil).
import { at, listOr, num, str } from '@sources/shape';

/** Open-Meteo answers one object for one place and a list for several: always a list, one per place. */
export const meteoPlaces = (reply: unknown): unknown[] => (Array.isArray(reply) ? reply : reply == null ? [] : [reply]);
/** A numeric column of an Open-Meteo block (daily, hourly), with gaps as null. */
export const meteoColumn = (place: unknown, block: string, field: string): (number | null)[] =>
  listOr(at(place, block, field)).map(num);
/** The time column of an Open-Meteo block, as strings. */
export const meteoTimes = (place: unknown, block: string): string[] => listOr(at(place, block, 'time')).map(str);
