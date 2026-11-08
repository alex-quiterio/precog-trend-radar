// PRECOG / Trend Radar · Reading stream: posts from the sites you follow (and the built-in ones), credited to
// the topics in scope they name. Posts naming a topic rank by match strength; the rest still show, lower.
import { topicRegex, topicTerms } from '@sources/registry';
import { inScope, registerStream, when } from '@sources/streams';
import { loadReading, readingSites, siteByUrl } from './index';
import { readingScore, type ReadingItem } from './parse';

/** A post, with the topic keys it names and how strongly. */
export interface ReadingMatch extends ReadingItem {
  topics: string[];
  score: number;
}
interface Data {
  found: Map<string, ReadingMatch>;
  /** Posts read from the channel's sites, matched or not. */
  seen: number;
  /** Sites that couldn't be read, if any. */
  failed: string | null;
}
const DAY = 86400e3;
// Recent first: a match counts half as much for every six months of age. An undated library entry (a film)
// counts as six months old: always there, but under what's new.
const fade = (t: number, now: number) => (t ? 0.5 ** ((now - t) / (182 * DAY)) : 0.5);
const ROWS = 12;
/** Rows kept for a kept library's entries, when the channel reads one. */
const FILM_ROWS = 3;
/** A stable shuffle key for an item on a given day. */
const spin = (id: string, day: number) => {
  let h = day | 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761);
  return (h >>> 0) / 2 ** 32;
};

registerStream<Data>({
  id: 'reading',
  label: 'Reading',
  // A channel that reads one site names the tab after it ("The Great Simplification"); a kept library beside it
  // (Campfire Stories' films) doesn't count.
  tabLabel: ctx => {
    const own = (ctx.sites ?? []).map(siteByUrl).filter(s => s && !s.library);
    return (own.length === 1 && own[0]?.name) || 'Reading';
  },
  async load(ctx, signal) {
    // A channel with its own sites reads only those (followed or not); any other reads every followed site.
    const sites = ctx.sites?.length
      ? ctx.sites.map(siteByUrl).filter((x): x is NonNullable<typeof x> => !!x)
      : readingSites();
    const { items, errors } = await loadReading(signal, sites);
    const matchers = ctx.entries.map(E => ({ key: E.key, res: topicTerms(E).map(topicRegex) }));
    const map = new Map<string, ReadingMatch>();
    items.forEach(it => {
      let score = 0;
      const topics: string[] = [];
      matchers.forEach(m => {
        const s = readingScore(it, m.res);
        if (s) {
          score += s;
          topics.push(m.key);
        }
      });
      map.set(it.id, { ...it, topics, score });
    });
    return { found: map, seen: items.length, failed: errors.length ? errors.join('; ') : null };
  },
  warning: data => data?.failed ?? null,
  view(ctx, data, at) {
    const rank = (r: ReadingMatch) => (inScope(r.topics, ctx).length ? r.score : 0.4) * fade(r.t, ctx.now);
    // Ties (unmatched films) take turns: a different few each day.
    const day = Math.floor(ctx.now / DAY);
    const list = [...(data?.found.values() ?? [])].sort(
      (a, b) => rank(b) - rank(a) || b.t - a.t || spin(a.id, day) - spin(b.id, day),
    );
    // A kept library (Campfire Stories' films) would never outrank hundreds of dated posts, so its best few
    // always get the last rows.
    const films = list.filter(r => !r.t).slice(0, FILM_ROWS);
    const shown = [...list.filter(r => r.t).slice(0, ROWS - films.length), ...films];
    const top = Math.max(1e-6, ...shown.map(rank));
    const matched = list.filter(r => inScope(r.topics, ctx).length).length;
    return {
      rows: shown.map(r => {
        const n = r.topics.length;
        return {
          id: r.id,
          title: r.title,
          url: r.url,
          topics: r.topics,
          meta: [
            { text: r.site, cls: 'site' },
            `${r.kind}${r.num ? ' #' + r.num : ''}`,
            ...(r.t ? [when(r.t, ctx.now)] : []),
          ],
          side: n
            ? {
                big: String(n),
                unit: n === 1 ? 'topic' : 'topics',
                note: r.score >= 3 ? 'in the title' : 'in the text',
              }
            : { note: r.t ? 'new' : '' }, // a film from a kept library isn't new
          bar: (rank(r) / top) * 100,
        };
      }),
      meta: at ? `${matched} of ${data?.seen ?? 0} posts name your topics` : '',
      empty: 'Nothing from the sites you follow yet.',
    };
  },
});
