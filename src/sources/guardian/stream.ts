// PRECOG / Trend Radar · The Guardian stream: the newest articles naming the topics in scope. It reuses what
// the trend fetch cached today; a topic not fetched yet is fetched now (same request, same cache).
import { ADAPTERS, queryOf } from '@sources/registry';
import { checked, inScope, registerStream, when } from '@sources/streams';
import { guardianArticles, guardianKey } from './index';
import type { GuardianArticle } from './parse';

/** A Guardian article, with the topic keys it names. */
export interface NewsMatch extends GuardianArticle {
  topics: string[];
}
type Data = Map<string, NewsMatch>;

registerStream<Data>({
  id: 'news',
  label: 'The Guardian',
  // ctx.keys mirrors the stored key reactively, so the tab appears as soon as a key is pasted.
  available: ctx => ctx.keys.guardian,
  async load(ctx, signal, show) {
    if (!guardianKey()) throw new Error('add a Guardian API key (top bar) to see Guardian articles');
    const map = new Map<string, NewsMatch>();
    for (const E of ctx.entries) {
      if (signal.aborted) break;
      const q = queryOf(E);
      if (!guardianArticles(q.q).length) await ADAPTERS.guardian.fetch(E.name, { signal, query: q });
      guardianArticles(q.q).forEach(a => {
        const m = map.get(a.id) || { ...a, topics: [] };
        if (!m.topics.includes(E.key)) m.topics.push(E.key);
        map.set(a.id, m);
      });
      show(new Map(map));
    }
    return map;
  },
  view(ctx, data, at) {
    // Articles naming more of the channel's topics first, then the newest.
    const list = [...(data?.values() ?? [])]
      .map(n => ({ ...n, topics: inScope(n.topics, ctx) }))
      .filter(n => n.topics.length)
      .sort((a, b) => b.topics.length - a.topics.length || b.t - a.t);
    const newest = Math.max(...list.map(n => n.t), 0),
      oldest = Math.min(...list.map(n => n.t), newest);
    return {
      rows: list.slice(0, 12).map(n => ({
        id: n.id,
        title: n.title,
        url: n.url,
        topics: n.topics,
        meta: [{ text: 'The Guardian', cls: 'site' }, ...(n.section ? [n.section] : []), when(n.t, ctx.now)],
        side: { big: String(n.topics.length), unit: n.topics.length === 1 ? 'topic' : 'topics', note: 'newest first' },
        bar: newest > oldest ? 15 + ((n.t - oldest) / (newest - oldest)) * 85 : 100,
      })),
      meta: checked(at, `${list.length} Guardian articles name your topics`, ctx.now),
      empty: 'No recent Guardian articles name these topics.',
    };
  },
});
