// PRECOG / Trend Radar · Forecasts stream: open Manifold markets whose question names a topic in scope.
import { shallowRef } from 'vue';
import { nf0 } from '@core/format';
import { pool, queryOf, topicRegex } from '@sources/registry';
import { checked, inScope, registerStream, when } from '@sources/streams';
import { searchForecasts } from './index';
import type { Forecast } from './parse';

/** An open prediction market, with the topic keys its question names. */
export interface ForecastMatch extends Forecast {
  topics: string[];
}
const found = shallowRef(new Map<string, ForecastMatch>());

registerStream({
  id: 'forecasts',
  label: 'Forecasts',
  async load(ctx, signal) {
    const map = new Map<string, ForecastMatch>();
    await pool(ctx.entries, 4, async E => {
      const qq = queryOf(E);
      // Manifold's search is fuzzy, so each question is checked for the topic itself.
      const res = [...new Set([qq.q, E.name].map(t => t.replace(/"/g, '').trim()))].map(topicRegex);
      (await searchForecasts(qq.q.replace(/"/g, ''), signal))
        .filter(f => res.some(re => re.test(f.question)))
        .forEach(f => {
          const m = map.get(f.id) || { ...f, topics: [] };
          if (!m.topics.includes(E.key)) m.topics.push(E.key);
          map.set(f.id, m);
        });
      found.value = new Map(map);
    });
    found.value = map;
  },
  view(ctx, at) {
    const list = [...found.value.values()]
      .filter(f => inScope(f.topics, ctx).length)
      .sort((a, b) => b.vol24 - a.vol24 || b.bettors - a.bettors);
    return {
      rows: list.slice(0, 12).map(f => ({
        id: f.id,
        title: f.question,
        url: f.url,
        topics: f.topics,
        meta: [`${nf0.format(f.bettors)} forecasters`, `resolves ${when(f.closes)}`],
        side: {
          big: `${Math.round(f.prob * 100)}%`,
          unit: 'yes',
          note: `Manifold · ${nf0.format(f.vol24)} traded today`,
        },
        bar: f.prob * 100,
      })),
      meta: checked(at, 'open markets on Manifold'),
      empty: 'No open forecast (10+ forecasters) names these topics.',
    };
  },
});
