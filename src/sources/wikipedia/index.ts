// PRECOG / Trend Radar · Wikipedia pageviews per day, in the lens language (en/pt/nl).
import { DAY, LS, store } from '@core/config';
import { looksLikePerson } from '@core/guard';
import {
  HttpError,
  getJSON,
  registerAdapter,
  utcDay,
} from '@sources/registry';
import {
  parsePageviews,
  parseTitleQuery,
  parseOpenSearch,
} from './parse';
export * from './parse';

// --- Wikipedia -------------------------------------------------------
/** How long to wait before the one retry of a request Wikipedia refused as too many (429). */
export const wiki = { retryMs: 2500 };
/**
 * Fetches from Wikipedia or Wikimedia. A 429 (too many requests: a burst of topics, or a few quick reloads) is
 * tried once more after a pause, since it usually clears in seconds.
 */
export async function getWikiJSON(
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  try {
    return await getJSON(url, signal);
  } catch (e) {
    if (
      !(e instanceof HttpError) ||
      e.status !== 429 ||
      signal?.aborted
    ) {
      throw e;
    }
    await new Promise(r => setTimeout(r, wiki.retryMs));
    return getJSON(url, signal);
  }
}
/** The message for topics whose article couldn't be read: a missing article only when that's what happened. */
export function wikiFailure(
  names: string[],
  errors: unknown[],
): string {
  const list = names.join(', ');
  if (
    errors.some(
      e => e instanceof HttpError && e.status === 429,
    )
  ) {
    return `Wikipedia is busy (too many requests) for ${list}; it will try again on the next refresh`;
  }
  if (
    errors.every(
      e =>
        e instanceof Error &&
        /Wikipedia article|about a person/.test(e.message),
    )
  ) {
    return `no Wikipedia article for ${list}`;
  }
  const first = errors.find(e => e instanceof Error) as
    Error | undefined;
  return `Wikipedia didn't answer for ${list}${first ? ` (${first.message})` : ''}`;
}
export async function resolveWikiTitle(
  q: string,
  signal: AbortSignal,
  lang = 'en',
): Promise<string> {
  const cache = store.get<Record<string, string>>(
      LS.wikiTitles,
      {},
    ),
    ck = `${lang}:${q}`;
  if (cache[ck]) {
    return cache[ck];
  }
  const api = `https://${lang}.wikipedia.org/w/api.php?format=json&origin=*&`;
  let title = parseTitleQuery(
    await getWikiJSON(
      api +
        `action=query&redirects=1&titles=${encodeURIComponent(q)}`,
      signal,
    ),
  );
  if (!title) {
    title = parseOpenSearch(
      await getWikiJSON(
        api +
          `action=opensearch&namespace=0&limit=1&search=${encodeURIComponent(q)}`,
        signal,
      ),
    );
  }
  if (!title) {
    throw new Error('no matching Wikipedia article');
  }
  if (looksLikePerson(title)) {
    throw new Error(
      'the closest Wikipedia article is about a person, so it is skipped',
    );
  }
  cache[ck] = title;
  store.set(LS.wikiTitles, cache);
  return title;
}
registerAdapter({
  id: 'wikipedia',
  label: 'Wikipedia pageviews / day',
  unit: 'views',
  concurrency: 4,
  weight: 0.35,
  minMean: 20,
  async fetch(topic, { signal, query }) {
    const lang = query.lang || 'en';
    const title = await resolveWikiTitle(
      query.wiki || topic,
      signal,
      lang,
    );
    const ymd = (t: number) =>
      new Date(t)
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');
    const end = utcDay() - DAY,
      start = end - 59 * DAY;
    const j = await getWikiJSON(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/daily/${ymd(start)}/${ymd(end)}`,
      signal,
    );
    return {
      topic,
      meta: { wikiTitle: title, wikiLang: lang },
      points: parsePageviews(j),
    };
  },
});
