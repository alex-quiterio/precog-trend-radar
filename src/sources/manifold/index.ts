// PRECOG / Trend Radar · Forecasts: open Manifold prediction markets on your topics, with the crowd's probability.
// Keyless, browser-readable API. Questions that name a person are dropped, to keep to topics.
import { MIN } from '@core/config';
import { getJSON } from '@sources/registry';
import { parseMarkets } from './parse';
import type { Forecast } from './parse';
export * from './parse';

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
  const found = parseMarkets(j);
  cache.set(key, { at: Date.now(), list: found });
  return found;
}
