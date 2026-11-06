// PRECOG / Trend Radar · Reading stream: posts from the sites you follow (and the built-in ones), credited to
// the topics in scope they name. Posts naming a topic rank by match strength; the rest still show, lower.
import { ref, shallowRef } from 'vue';
import { ui } from '@core/ui-store';
import { queryOf, topicRegex } from '@sources/registry';
import { inScope, registerStream, when } from '@sources/streams';
import { loadReading, readingSites } from './index';
import { readingScore, type ReadingItem } from './parse';

/** A post, with the topic keys it names and how strongly. */
export interface ReadingMatch extends ReadingItem {
  topics: string[];
  score: number;
}
const found = shallowRef(new Map<string, ReadingMatch>());
const seen = ref(0); // posts read from the channel's sites, matched or not
const failed = ref<string | null>(null); // sites that couldn't be read
const DAY = 86400e3;
// Recent first: a match counts half as much for every six months of age.
const fade = (t: number) => 0.5 ** ((ui.now - t) / (182 * DAY));

registerStream({
  id: 'reading',
  label: 'Reading',
  // A channel that reads one site names the tab after it ("The Great Simplification").
  tabLabel: ctx => (ctx.sites?.length === 1 && readingSites().find(s => s.url === ctx.sites?.[0])?.name) || 'Reading',
  async load(ctx, signal) {
    const { items: all, errors } = await loadReading(signal);
    const items = ctx.sites?.length ? all.filter(it => ctx.sites?.includes(it.origin)) : all;
    const matchers = ctx.entries.map(E => {
      const qq = queryOf(E);
      const terms = [
        ...new Set([qq.q, E.name, qq.wiki].filter((t): t is string => !!t).map(t => t.replace(/"/g, '').trim())),
      ];
      return { key: E.key, res: terms.filter(t => t.length >= 2).map(topicRegex) };
    });
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
    found.value = map;
    seen.value = items.length;
    failed.value = errors.length ? errors.join('; ') : null;
  },
  warning: () => failed.value,
  view(ctx, at) {
    const rank = (r: ReadingMatch) => (inScope(r.topics, ctx).length ? r.score : 0.4) * fade(r.t);
    const list = [...found.value.values()].sort((a, b) => rank(b) - rank(a) || b.t - a.t);
    const top = Math.max(1e-6, ...list.slice(0, 12).map(rank));
    const matched = list.filter(r => inScope(r.topics, ctx).length).length;
    return {
      rows: list.slice(0, 12).map(r => {
        const n = r.topics.length;
        return {
          id: r.id,
          title: r.title,
          url: r.url,
          topics: r.topics,
          meta: [{ text: r.site, cls: 'site' }, `${r.kind}${r.num ? ' #' + r.num : ''}`, when(r.t)],
          side: n
            ? {
                big: String(n),
                unit: n === 1 ? 'topic' : 'topics',
                note: r.score >= 3 ? 'in the title' : 'in the text',
              }
            : { note: 'new' },
          bar: (rank(r) / top) * 100,
        };
      }),
      meta: at ? `${matched} of ${seen.value} posts name your topics` : '',
      empty: 'Nothing from the sites you follow yet.',
    };
  },
});
