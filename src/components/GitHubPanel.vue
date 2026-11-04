<template>
  <panel-shell id="p-github" title="Open-source momentum" :meta="view.meta" :index="index" :data-tick="ui.v">
    <template #controls>
      <button class="btn small no-print" type="button" :disabled="gh.loading" @click="reload">↻ Recount</button>
    </template>

    <div class="gh-tiles">
      <div class="tile">
        <span class="tile-k">New repos · 90 days</span>
        <b class="tile-v">{{ view.total == null ? '—' : nf0.format(view.total) }}</b>
        <span class="tile-s">across {{ view.topics.length }} of {{ gh.total }} topics</span>
      </div>
      <div class="tile">
        <span class="tile-k">vs the 90 days before</span>
        <b class="tile-v">{{ view.growth == null ? '—' : pct(view.growth) }}</b>
        <span class="tile-s">{{ view.before == null ? '' : nf0.format(view.before) + ' then' }}</span>
      </div>
      <div class="tile">
        <span class="tile-k">Fastest-growing topic</span>
        <b class="tile-v small">{{ view.fastest ? view.fastest.name : '—' }}</b>
        <span class="tile-s">{{ view.fastest ? pct(view.fastest.growth) : '' }}</span>
      </div>
      <div class="tile">
        <span class="tile-k">Top language</span>
        <b class="tile-v small">{{ view.langs[0] ? view.langs[0].lang : '—' }}</b>
        <span class="tile-s">
          {{ view.langs[0] ? Math.round(view.langs[0].share * 100) + '% of leading repos' : '' }}
        </span>
      </div>
    </div>

    <div class="gh-grid">
      <figure class="gh-fig">
        <figcaption>
          New repositories per topic
          <span class="muted">bar: last 90 days · tick: the 90 days before</span>
        </figcaption>
        <ul class="gh-bars">
          <li v-for="t in view.bars" :key="t.key" :title="barTip(t)">
            <span class="gh-name">
              <topic-dot :color="t.color"></topic-dot>
              {{ t.name }}
            </span>
            <span class="gh-track">
              <i class="gh-bar" :style="{ width: t.w + '%', background: t.color }"></i>
              <i class="gh-tick" :style="{ left: t.wb + '%' }"></i>
            </span>
            <span class="gh-val">
              {{ nf0.format(t.now) }}
              <small :class="{ up: (t.growth ?? 0) > 0, down: (t.growth ?? 0) < 0 }">
                {{ t.growth == null ? 'new' : pct(t.growth) }}
              </small>
            </span>
          </li>
          <li v-if="!view.bars.length" class="empty">{{ view.empty }}</li>
        </ul>
      </figure>

      <figure class="gh-fig">
        <figcaption>
          Languages
          <span class="muted">among each topic's 30 most-starred new repos</span>
        </figcaption>
        <ul class="gh-bars langs">
          <li v-for="l in view.langs" :key="l.lang" :title="`${l.lang}: ${l.count} repos`">
            <span class="gh-name">{{ l.lang }}</span>
            <span class="gh-track"><i class="gh-bar neutral" :style="{ width: l.w + '%' }"></i></span>
            <span class="gh-val">{{ Math.round(l.share * 100) }}%</span>
          </li>
          <li v-if="!view.langs.length" class="empty">{{ view.empty }}</li>
        </ul>
      </figure>
    </div>

    <h4 class="gh-sub">
      Rising repositories
      <span class="muted">new in the last 90 days, by stars per day</span>
    </h4>
    <ol class="stories">
      <li v-for="(r, i) in view.rising" :key="r.name" class="story">
        <span class="rank">{{ i + 1 }}</span>
        <div>
          <div class="title">
            <a :href="r.url" target="_blank" rel="noopener noreferrer">{{ r.name }}</a>
          </div>
          <div class="smeta">
            <span class="stopic">
              <topic-dot :color="r.topic.color"></topic-dot>
              {{ r.topic.name }}
            </span>
            <span v-if="r.language">{{ r.language }}</span>
            <span>created {{ ago(r.created) }}</span>
            <span v-if="r.desc" class="desc">{{ r.desc }}</span>
          </div>
        </div>
        <div class="vel">
          <b>★ {{ nf1.format(r.pace) }}</b>
          /day
          <small>{{ nf0.format(r.stars) }} stars</small>
          <div class="vbar"><i :style="{ width: r.w + '%' }"></i></div>
        </div>
      </li>
      <li v-if="!view.rising.length" class="empty">{{ view.empty }}</li>
      <li v-if="gh.error" class="empty">{{ gh.error }}.</li>
    </ol>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { ago, nf0, nf1 } from '../core/format';
import { ui } from '../core/ui-store';
import { gh, languageMix, loadGitHub, risingRepos, type GhTopic } from '../features/github';
import { activeLens } from '../state';
import PanelShell from './PanelShell.vue';
import TopicDot from './TopicDot.vue';

// PRECOG / Trend Radar · GitHub view: how much is being built around the active lens's topics.

const pct = (g: number) => `${g >= 0 ? '+' : '−'}${Math.round(Math.abs(g) * 100)}%`;

export default defineComponent({
  name: 'GitHubPanel',
  props: { index: Number },
  components: { PanelShell, TopicDot },
  setup() {
    const view = computed(() => {
      ui.v;
      const topics = gh.topics;
      const max = Math.max(1, ...topics.flatMap(t => [t.now, t.before]));
      const sum = (f: (t: GhTopic) => number) => topics.reduce((a, t) => a + f(t), 0);
      const total = topics.length ? sum(t => t.now) : null,
        before = topics.length ? sum(t => t.before) : null;
      const fastest = topics
        .filter(t => t.growth != null && t.now >= 10)
        .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];
      const langs = languageMix(topics);
      const lmax = Math.max(1e-6, ...langs.map(l => l.share));
      const rising = risingRepos(topics);
      const pmax = Math.max(1e-6, ...rising.map(r => r.pace));
      return {
        lensName: activeLens()?.name || '',
        topics,
        total,
        before,
        growth: total != null && before ? (total - before) / before : null,
        fastest,
        bars: [...topics]
          .sort((a, b) => b.now - a.now)
          .map(t => ({ ...t, w: (t.now / max) * 100, wb: (t.before / max) * 100 })),
        langs: langs.map(l => ({ ...l, w: (l.share / lmax) * 100 })),
        rising: rising.map(r => ({ ...r, w: (r.pace / pmax) * 100 })),
        meta: gh.loading
          ? `counting… ${gh.done}/${gh.total} topics (GitHub allows ${ui.ghToken ? '~30' : '~10'} searches a minute)`
          : gh.at
            ? `counted ${ago(gh.at)} · GitHub search`
            : '',
        empty: gh.loading ? 'Counting repositories…' : 'No repositories found for these topics.',
      };
    });
    const barTip = (t: GhTopic) =>
      `${t.name}: ${t.now} new repos in the last 90 days, ${t.before} in the 90 days before` +
      (t.growth == null ? '' : ` (${pct(t.growth)})`);
    return { ui, gh, view, pct, barTip, ago, nf0, nf1, reload: () => loadGitHub(true) };
  },
});
</script>
