// PRECOG / Trend Radar · Forecasts: open Manifold prediction markets on your topics, with the crowd's probability.
// Keyless, browser-readable API. Questions that name a person are dropped, to keep to topics.
import { MIN } from '../core/config';
import { looksLikePerson } from '../core/guard';
import { getJSON } from './registry';

export interface Forecast {
  id: string;
  question: string;
  url: string;
  prob: number;
  bettors: number;
  vol24: number;
  closes: number;
}

// Surnames that headline markets on their own ("Will Putin …"); the first-name guard can't see these.
const SURNAMES = new Set(
  'trump biden harris vance obama putin zelensky zelenskyy netanyahu xi jinping modi macron merz scholz starmer sunak meloni milei erdogan orban musk bezos zuckerberg altman khamenei kim lula montenegro'.split(
    ' ',
  ),
);
/** True when the text names a person: a known surname, a title, a handle, or a 2–3-word name. */
export function mentionsPerson(text: string): boolean {
  // "Will" opens most questions, and the guard would read "Will Russia" as a name.
  const words = String(text)
    .replace(/^(will|would|does|is|are|can|did|has|have)\s+/i, '')
    .split(/[\s,;:?!()"“”’'.]+/)
    .filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (/^@\w/.test(words[i]) || SURNAMES.has(words[i].toLowerCase().replace(/'s$/, ''))) return true;
    for (const n of [2, 3]) {
      const run = words.slice(i, i + n);
      if (run.length === n && run.every(w => /^\p{Lu}/u.test(w)) && looksLikePerson(run.join(' '))) return true;
    }
  }
  return /\b(President|Senator|Prime Minister|Chancellor|CEO|King|Queen|Pope)\s+\p{Lu}/u.test(text);
}

const cache = new Map<string, { at: number; list: Forecast[] }>();
/** Open yes/no markets for a search phrase, at least 10 forecasters, resolving in the future. */
export async function searchForecasts(q: string, signal: AbortSignal): Promise<Forecast[]> {
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30 * MIN) return hit.list;
  const j = await getJSON(
    `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(q)}&limit=25&filter=open&contractType=BINARY`,
    signal,
  );
  const now = Date.now();
  const list: Forecast[] = (Array.isArray(j) ? j : [])
    .filter(m => typeof m.probability === 'number' && (m.uniqueBettorCount || 0) >= 10 && m.closeTime > now)
    .filter(m => !mentionsPerson(m.question))
    .map(m => ({
      id: 'mf:' + m.id,
      question: String(m.question).trim(),
      url: m.url,
      prob: m.probability,
      bettors: m.uniqueBettorCount || 0,
      vol24: m.volume24Hours || 0,
      closes: m.closeTime,
    }));
  cache.set(key, { at: Date.now(), list });
  return list;
}
