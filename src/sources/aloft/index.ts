// PRECOG / Trend Radar · Aloft: birds measured by Europe's weather radars (aloftdata.eu, CC0). One radar's day is
// ~1.5 MB of CSV and arrives a day or two late, so each radar keeps its summary (and the day before's) and
// downloads a file at most once. Only the Bird migration channel reads it, while it is on screen.
import { DAY, HOUR } from '@core/config';
import { store } from '@core/storage';
import { HttpError, withTimeout } from '@sources/registry';
import { type MigrationDay, parseVpts } from './parse';
export * from './parse';

const BUCKET = 'https://aloftdata.s3-eu-west-1.amazonaws.com/baltrad/daily';
const RECHECK = 6 * HOUR;

/** A radar's newest day, and the one before it when we saw it (for "busier than the night before"). */
export interface RadarDays {
  day: MigrationDay;
  prev?: MigrationDay;
}
type Cached = RadarDays & { file: string; checked: number };
const key = (radar: string) => `precog.aloft.v1.${radar}`;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');

/** A radar's newest day: from the cache when checked lately, else the newest file of the last 3 days. */
export async function latestDay(radar: string, signal?: AbortSignal, now = Date.now()): Promise<RadarDays> {
  const hit = store.get<Cached | null>(key(radar), null);
  if (hit && now - hit.checked < RECHECK) return hit;
  for (let back = 1; back <= 3; back++) {
    const file = ymd(now - back * DAY);
    if (hit?.file === file) break; // nothing newer than what we have
    const r = await fetch(`${BUCKET}/${radar}/${file.slice(0, 4)}/${radar}_vpts_${file}.csv`, {
      signal: withTimeout(signal, 60e3),
    });
    if (r.status === 404 || r.status === 403) continue; // not published yet
    if (!r.ok) throw new HttpError(r.status);
    const day = parseVpts(await r.text());
    // The day before is worth keeping only when it really is the day before.
    const prev = hit && Date.parse(day.day) - Date.parse(hit.day.day) === DAY ? hit.day : undefined;
    const out: Cached = { file, checked: now, day, prev };
    store.set(key(radar), out);
    return out;
  }
  if (hit) {
    store.set(key(radar), { ...hit, checked: now });
    return hit;
  }
  throw new Error('no radar file in the last 3 days');
}
