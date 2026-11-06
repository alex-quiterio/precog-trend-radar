// PRECOG / Trend Radar · Hacker News stream: stories from the last 48 h naming the topics in scope, ranked by
// engagement per hour (measured between visits when possible, otherwise averaged since posting).
import { HOUR, LS, MIN, store } from '@core/config';
import { ago, nf0 } from '@core/format';
import { quantile } from '@core/stats';
import { getJSON, phrase, pool, queryOf, topicRegex } from '@sources/registry';
import { checked, inScope, registerStream } from '@sources/streams';
import { parseStoryHits } from './parse';

/** A Hacker News story with its measured or estimated engagement velocity. */
export interface HNStory {
  id: string;
  title: string;
  url: string;
  discuss: string;
  domain: string;
  t: number;
  points: number;
  comments: number;
  topics: string[];
  /** Engagement (points + comments) per hour; filled in once every topic has been searched. */
  vel?: number;
  /** Hours since posting. */
  age?: number;
  /** Expected engagement 24 h after posting. */
  pred24?: number;
  /** Whether vel was measured between two visits (true) or averaged since posting (false). */
  measured?: boolean;
}
export const TAU = 8; // hours; engagement modelled as E(t) = E∞·(1 − e^(−t/τ))
/** What the stream loads: stories by id. */
export type HNData = Map<string, HNStory>;
/** The stories in a Hacker News stream result (as the stream loader keeps it), for the gist's "Rising stories". */
export const hnStories = (data: unknown): HNStory[] => (data instanceof Map ? [...(data as HNData).values()] : []);

/** A link's host without www, or '' when it isn't a valid URL. */
const hostOf = (url: string): string => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
};
interface Observation {
  t: number;
  eng: number;
}
/**
 * Records a story's engagement now and returns its measured rate (per hour) from two observations at least
 * five minutes apart, or null until there are two.
 */
export function observe(id: string, eng: number): number | null {
  const obs = store.get<Record<string, { prev?: Observation; cur: Observation }>>(LS.storyObs, {});
  const now = Date.now(),
    o = obs[id];
  let rate: number | null = null;
  if (o && o.prev && o.cur.t - o.prev.t >= 5 * MIN) rate = (o.cur.eng - o.prev.eng) / ((o.cur.t - o.prev.t) / HOUR);
  if (!o) obs[id] = { cur: { t: now, eng } };
  else if (now - o.cur.t >= 5 * MIN) {
    obs[id] = { prev: o.cur, cur: { t: now, eng } };
    rate = (eng - o.cur.eng) / ((now - o.cur.t) / HOUR);
  }
  Object.keys(obs).forEach(k => {
    if (now - obs[k].cur.t > 72 * HOUR) delete obs[k];
  });
  store.set(LS.storyObs, obs);
  return rate;
}

registerStream<HNData>({
  id: 'hn',
  label: 'Hacker News',
  async load(ctx, signal, show) {
    const since = Math.floor((Date.now() - 48 * HOUR) / 1000);
    const map = new Map<string, HNStory>();
    await pool(
      ctx.entries.filter(E => queryOf(E).lang === 'en'),
      4,
      async E => {
        const q = phrase(queryOf(E).q);
        const j = await getJSON(
          `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&typoTolerance=false&tags=story&hitsPerPage=20&numericFilters=${encodeURIComponent('created_at_i>' + since)}&attributesToRetrieve=title,url,points,num_comments,created_at_i`,
          signal,
        );
        const re = topicRegex(queryOf(E).q);
        parseStoryHits(j)
          .filter(h => re.test(h.title))
          .forEach(h => {
            const discuss = `https://news.ycombinator.com/item?id=${h.objectID}`;
            const s: HNStory = map.get(h.objectID) || {
              id: 'hn:' + h.objectID,
              title: h.title,
              url: h.url || discuss,
              discuss,
              domain: hostOf(h.url) || 'news.ycombinator.com',
              t: h.t,
              points: h.points,
              comments: h.comments,
              topics: [],
            };
            if (!s.topics.includes(E.key)) s.topics.push(E.key);
            map.set(h.objectID, s);
          });
        show(new Map(map)); // show stories as each topic answers
      },
    );
    const now = Date.now();
    map.forEach(s => {
      const age = Math.max(0.5, (now - s.t) / HOUR),
        eng = s.points + s.comments;
      const measured = observe(s.id, eng);
      s.measured = measured != null;
      s.vel = measured != null ? Math.max(0, measured) : eng / age;
      const einf = eng / (1 - Math.exp(-age / TAU));
      s.pred24 = age >= 24 ? eng : einf * (1 - Math.exp(-24 / TAU));
      s.age = age;
    });
    return map;
  },
  view(ctx, data, at) {
    let list = hnStories(data).filter(s => inScope(s.topics, ctx).length);
    const vel = (s: HNStory) => s.vel ?? 0;
    list.sort((a, b) => vel(b) - vel(a));
    if (ctx.scope !== 'topic') {
      // At most three per topic, so one busy topic doesn't fill the list.
      const per: Record<string, number> = {};
      list = list.filter(s => (per[s.topics[0]] = (per[s.topics[0]] || 0) + 1) <= 3);
    }
    const p80 = quantile(list.map(vel), 0.8),
      vmax = Math.max(1, ...list.map(vel));
    return {
      rows: list.slice(0, 12).map(s => ({
        id: s.id,
        title: s.title,
        url: s.url,
        topics: s.topics,
        meta: [
          s.domain,
          ago(s.t, ctx.now),
          { text: `${nf0.format(s.points)} pts · ${nf0.format(s.comments)} comments`, href: s.discuss },
          ...((s.age ?? 99) < 8 && vel(s) >= p80 && list.length >= 5 ? [{ text: '↗ BREAKING OUT', cls: 'flag' }] : []),
        ],
        side: {
          big: nf0.format(vel(s)),
          unit: '/h',
          note: `${s.measured ? 'measured' : 'avg since posted'} · ≈${nf0.format(s.pred24 ?? 0)} by 24h`,
        },
        bar: (vel(s) / vmax) * 100,
      })),
      meta: checked(at, 'ranked by engagement per hour', ctx.now),
      empty: 'No Hacker News stories in the last 48 h for these topics (English topics only).',
    };
  },
});
