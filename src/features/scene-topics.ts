// PRECOG / Trend Radar · Alt Amsterdam's topics, picked each day from what is moving in its scene. A pool of the
// cooperative, regenerative city's subjects is scored on two signals: how much more its Wikipedia article is
// read this week than in the month before, and how often the channel's own sites (Commons Network, Shareable,
// Repair Café, Resilience) named it in recent posts. The best six become the channel's topics, through the
// same store as World's (features/hot-topics.ts), so pins, your own topics and removals work the same way.
// The pool is curated, so no pick is ever a person; your own additions join the pool.
import { DAY, store } from '@core/config';
import { getJSON, pool as inPool, topicRegex } from '@sources/registry';
import { parsePageviews } from '@sources/wikipedia/parse';
import { CHANNEL_SITES, loadReading } from '@sources/reading';
import type { ReadingItem } from '@sources/reading/parse';
import type { Candidate, Echo } from './hot-topics';

export const SCENE_LENS = 'amsterdam';
export const SCENE_KEY = 'precog.scene.v1';
const VIEWS_KEY = 'precog.scene.views.v1';

/** The scene's subjects: [name, Wikipedia title, search phrase]. */
export const SCENE_POOL: [string, string, string][] = [
  ['Doughnut economics', 'Doughnut (economic model)', 'doughnut economics'],
  ['Housing cooperative', 'Housing cooperative', 'housing cooperative'],
  ['Community land trust', 'Community land trust', 'community land trust'],
  ['Squatting', 'Squatting', 'squat'],
  ['Urban agriculture', 'Urban agriculture', 'urban agriculture'],
  ['Repair Café', 'Repair Café', 'repair caf'],
  ['Mutual aid', 'Mutual aid', 'mutual aid'],
  ['Commons', 'Commons', 'commons'],
  ['Library of things', 'Library of things', 'library of things'],
  ['Energy cooperative', 'Renewable energy cooperative', 'energy cooperative'],
  ['Community solar', 'Community solar', 'community solar'],
  ['Food cooperative', 'Food cooperative', 'food cooperative'],
  ['Platform cooperative', 'Platform cooperative', 'platform cooperative'],
  ['Worker cooperative', 'Worker cooperative', 'worker cooperative'],
  ['Participatory budgeting', 'Participatory budgeting', 'participatory budgeting'],
  ['Car-free cities', 'Car-free movement', 'car-free'],
  ['15-minute city', '15-minute city', '15-minute city'],
  ['Cohousing', 'Cohousing', 'cohousing'],
  ['Right to repair', 'Right to repair', 'right to repair'],
  ['Community gardening', 'Community gardening', 'community garden'],
  ['Rewilding', 'Rewilding', 'rewilding'],
  ['Universal basic income', 'Universal basic income', 'basic income'],
  ['Degrowth', 'Degrowth', 'degrowth'],
  ['Food sovereignty', 'Food sovereignty', 'food sovereignty'],
];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
/** This week's daily views against the four weeks before (1 = as usual), from oldest-first daily counts. */
export function viewsSurge(daily: number[]): number | null {
  if (daily.length < 14) return null;
  const week = daily.slice(-7),
    before = daily.slice(-35, -7);
  const usual = median(before);
  return usual >= 5 ? week.reduce((a, b) => a + b, 0) / 7 / usual : null;
}
/** How strongly recent posts name a topic: a title counts double, and a post counts half for every month of age. */
export function siteMentions(
  items: ReadingItem[],
  phrase: string,
  now: number,
): { weight: number; posts: number; sites: string[] } {
  const re = topicRegex(phrase);
  let weight = 0,
    posts = 0;
  const sites = new Set<string>();
  items.forEach(it => {
    const inTitle = re.test(it.title),
      inText = re.test(it.text);
    if (!inTitle && !inText) return;
    posts++;
    sites.add(it.site);
    weight += (inTitle ? 2 : 1) * 0.5 ** ((now - it.t) / (30 * DAY));
  });
  return { weight, posts, sites: [...sites] };
}
/**
 * Scores the pool. Momentum: up to +3 for an article read twice as much (or more) as usual, down to −1.5 for
 * one read half as much. Mentions: up to +4. Nothing scores below the pool's base, so a quiet day still fills
 * the channel, with the steadiest subjects.
 */
export function sceneCandidates(
  topics: [string, string, string][],
  surge: Map<string, number | null>,
  items: ReadingItem[],
  now: number,
  skip: Set<string> = new Set(),
): Candidate[] {
  return topics
    .filter(([name]) => !skip.has(name.toLowerCase()))
    .map(([name, wiki, q]) => {
      const echoes: Echo[] = [],
        notes: string[] = [];
      const x = surge.get(wiki) ?? null;
      let score = 0;
      if (x != null) {
        score += Math.max(-1.5, Math.min(3, 3 * Math.log2(x)));
        if (x >= 1.2) echoes.push('views');
        if (Math.abs(x - 1) >= 0.15) notes.push(`read ${x.toFixed(1)}× its usual on Wikipedia this week`);
      }
      const m = siteMentions(items, q, now);
      if (m.posts) {
        score += Math.min(4, 1.5 * m.weight);
        echoes.push('sites');
        notes.push(`${m.posts} recent post${m.posts > 1 ? 's' : ''} on ${m.sites.slice(0, 2).join(' and ')}`);
      }
      return { name, wiki, q, qid: '', score, echoes, aliases: [], notes };
    })
    .sort((a, b) => b.score - a.score);
}

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');
/** Each article's surge (see viewsSurge), cached for the day. One pageviews call per article, four at a time. */
async function surges(titles: string[], signal: AbortSignal, now: number): Promise<Map<string, number | null>> {
  const day = ymd(now);
  const cached = store.get<{ day: string; v: Record<string, number | null> } | null>(VIEWS_KEY, null);
  const v: Record<string, number | null> = cached?.day === day ? { ...cached.v } : {};
  await inPool(
    titles.filter(t => !(t in v)),
    4,
    async t => {
      try {
        const points = parsePageviews(
          await getJSON(
            `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(t.replace(/ /g, '_'))}/daily/${ymd(now - 36 * DAY)}/${ymd(now - DAY)}`,
            signal,
          ),
        );
        v[t] = viewsSurge(points.map(p => p.value));
      } catch {
        if (signal.aborted) throw new DOMException('aborted', 'AbortError');
        v[t] = null;
      }
    },
  );
  store.set(VIEWS_KEY, { day, v });
  return new Map(Object.entries(v));
}

/**
 * Today's candidates for Alt Amsterdam: the pool plus the topics you added to the channel yourself. `lensTopics`
 * gives the channel's topics now, so one you added stays in the running.
 */
export function sceneSource(lensTopics: () => { name: string; wiki?: string; q?: string }[], now = Date.now) {
  return async (signal: AbortSignal, skip: Set<string>): Promise<Candidate[]> => {
    const t = now();
    const pool = [...SCENE_POOL];
    lensTopics().forEach(d => {
      if (!pool.some(([n]) => n.toLowerCase() === d.name.toLowerCase()))
        pool.push([d.name, d.wiki || d.name, (d.q || d.name).replace(/"/g, '')]);
    });
    const [surge, reading] = await Promise.all([
      surges(
        pool.map(([, w]) => w),
        signal,
        t,
      ),
      loadReading(signal, CHANNEL_SITES).catch(() => ({ items: [] as ReadingItem[], errors: [] })),
    ]);
    const recent = reading.items.filter(it => t - it.t < 60 * DAY);
    return sceneCandidates(pool, surge, recent, t, skip);
  };
}
