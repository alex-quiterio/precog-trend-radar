<template>
  <panel-shell id="p-stories" title="Matched to your topics" :meta="view.meta" :index="index" :data-tick="ui.v">
    <template #controls>
      <span class="seg no-print" role="group" aria-label="Signal source">
        <button
          v-for="[id, label] in tabs"
          :key="id"
          type="button"
          :aria-pressed="state.storySrc === id"
          @click="setStorySource(id)"
        >
          {{ label }}
        </button>
      </span>
      <span class="seg no-print" role="group" aria-label="Which topics">
        <button
          v-for="[id, label] in SCOPES"
          :key="id"
          type="button"
          :aria-pressed="state.storyScope === id"
          @click="setStoryScope(id)"
        >
          {{ label }}
        </button>
      </span>
    </template>

    <div v-if="view.src === 'reading' && !view.fixedSites" class="sites no-print">
      <span class="muted">Following</span>
      <span v-for="s in sites" :key="s.url" class="site-chip">
        <a :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.name }}</a>
        <button type="button" :aria-label="'Stop following ' + s.name" @click="unfollow(s.url)">×</button>
      </span>
      <form class="site-add" autocomplete="off" @submit.prevent="follow">
        <label class="sr-only" for="site-input">Follow a WordPress site</label>
        <input id="site-input" v-model="newSite" placeholder="+ follow a site (WordPress)" :disabled="adding" />
      </form>
      <span v-if="siteMsg" class="muted err">{{ siteMsg }}</span>
    </div>

    <ol class="stories">
      <template v-if="view.src === 'news'">
        <li v-for="(it, i) in view.items" :key="it.n.id" class="story">
          <span class="rank">{{ i + 1 }}</span>
          <div>
            <div class="title">
              <a :href="it.n.url" target="_blank" rel="noopener noreferrer">{{ it.n.title }}</a>
            </div>
            <div class="smeta">
              <span v-for="E in it.topics" :key="E.key" class="stopic">
                <topic-dot :color="E.color"></topic-dot>
                {{ E.name }}
              </span>
              <span class="site">The Guardian</span>
              <span v-if="it.n.section">{{ it.n.section }}</span>
              <span>{{ when(it.n.t) }}</span>
            </div>
          </div>
          <div class="vel">
            <b>{{ it.n.topics.length }}</b>
            {{ it.n.topics.length === 1 ? 'topic' : 'topics' }}
            <small>newest first</small>
            <div class="vbar"><i :style="{ width: it.pct.toFixed(1) + '%' }"></i></div>
          </div>
        </li>
      </template>
      <template v-else-if="view.src === 'reading'">
        <li v-for="(it, i) in view.items" :key="it.r.id" class="story">
          <span class="rank">{{ i + 1 }}</span>
          <div>
            <div class="title">
              <a :href="it.r.url" target="_blank" rel="noopener noreferrer">{{ it.r.title }}</a>
            </div>
            <div class="smeta">
              <span v-for="E in it.topics" :key="E.key" class="stopic">
                <topic-dot :color="E.color"></topic-dot>
                {{ E.name }}
              </span>
              <span class="site">{{ it.r.site }}</span>
              <span>{{ it.r.kind }}{{ it.r.num ? ' #' + it.r.num : '' }}</span>
              <span>{{ when(it.r.t) }}</span>
            </div>
          </div>
          <div class="vel">
            <template v-if="it.r.topics.length">
              <b>{{ it.r.topics.length }}</b>
              {{ it.r.topics.length === 1 ? 'topic' : 'topics' }}
              <small>{{ it.r.score >= 3 ? 'in the title' : 'in the text' }}</small>
            </template>
            <small v-else>new</small>
            <div class="vbar"><i :style="{ width: it.pct.toFixed(1) + '%' }"></i></div>
          </div>
        </li>
      </template>

      <template v-else-if="view.src === 'forecasts'">
        <li v-for="(it, i) in view.items" :key="it.f.id" class="story">
          <span class="rank">{{ i + 1 }}</span>
          <div>
            <div class="title">
              <a :href="it.f.url" target="_blank" rel="noopener noreferrer">{{ it.f.question }}</a>
            </div>
            <div class="smeta">
              <span v-for="E in it.topics" :key="E.key" class="stopic">
                <topic-dot :color="E.color"></topic-dot>
                {{ E.name }}
              </span>
              <span>{{ nf0.format(it.f.bettors) }} forecasters</span>
              <span>resolves {{ when(it.f.closes) }}</span>
            </div>
          </div>
          <div class="vel">
            <b>{{ Math.round(it.f.prob * 100) }}%</b>
            yes
            <small>Manifold · {{ nf0.format(it.f.vol24) }} traded today</small>
            <div class="vbar"><i :style="{ width: it.pct.toFixed(1) + '%' }"></i></div>
          </div>
        </li>
      </template>

      <template v-else>
        <li v-for="(it, i) in view.items" :key="it.s.id" class="story">
          <span class="rank">{{ i + 1 }}</span>
          <div>
            <div class="title">
              <a :href="it.s.url" target="_blank" rel="noopener noreferrer">{{ it.s.title }}</a>
            </div>
            <div class="smeta">
              <span v-for="E in it.topics" :key="E.key" class="stopic">
                <topic-dot :color="E.color"></topic-dot>
                {{ E.name }}
              </span>
              <span>{{ it.s.domain }}</span>
              <span>{{ ago(it.s.t) }}</span>
              <a :href="it.s.discuss" target="_blank" rel="noopener noreferrer">
                {{ nf0.format(it.s.points) }} pts · {{ nf0.format(it.s.comments) }} comments
              </a>
              <span v-if="it.breaking" class="flag">↗ BREAKING OUT</span>
            </div>
          </div>
          <div class="vel">
            <b>{{ nf0.format(it.s.vel) }}</b>
            /h
            <small>{{ it.s.measured ? 'measured' : 'avg since posted' }} · ≈{{ nf0.format(it.s.pred24) }} by 24h</small>
            <div class="vbar"><i :style="{ width: it.pct.toFixed(1) + '%' }"></i></div>
          </div>
        </li>
      </template>
      <li v-if="!view.items.length" class="empty">{{ view.empty }}</li>
      <li v-if="view.warn" class="empty">{{ view.warn }}</li>
    </ol>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue';
import type { Entry } from '../types';
import type { ForecastMatch, HNStory, NewsMatch, ReadingMatch } from '../features/stories';
import { addReadingSite, removeReadingSite, setStoryScope, setStorySource } from '../actions';
import { ago } from '../core/format';
import { quantile } from '../core/stats';
import { ui } from '../core/ui-store';
import { stories, storyScopeEntries } from '../features/stories';
import { readingSites } from '../sources/reading';
import { state } from '../state';
import { activeChannel } from '../channels';
import TopicDot from './TopicDot.vue';
import PanelShell from './PanelShell.vue';

// PRECOG / Trend Radar · Signals: posts from sites you follow, Manifold forecasts and Hacker News,
// each matched to the topics in scope.

interface Item {
  n?: NewsMatch;
  r?: ReadingMatch;
  f?: ForecastMatch;
  s?: HNStory;
  topics: Entry[];
  breaking?: boolean;
  pct: number;
}
const DAY_MS = 86400e3;
// Recent first: a match counts half as much for every six months of age.
const fade = (t: number) => 0.5 ** ((Date.now() - t) / (182 * DAY_MS));

export default defineComponent({
  name: 'StoriesPanel',
  props: { index: Number },
  components: { PanelShell, TopicDot },
  setup() {
    const newSite = ref(''),
      siteMsg = ref(''),
      adding = ref(false);
    const sites = computed(() => (ui.v, readingSites()));
    const view = computed(() => {
      ui.v;
      const src = state.storySrc;
      const scopeKeys = new Set(storyScopeEntries().map(E => E.key));
      const topicsOf = (keys: string[]) =>
        keys
          .filter(k => scopeKeys.has(k))
          .map(k => state.rt.get(k))
          .filter(Boolean)
          .slice(0, 2);
      const loading = stories.loading[src],
        err = stories.errors[src],
        at = stories.at[src];
      let items: Item[] = [],
        meta = '',
        empty = '';
      if (src === 'news') {
        // Articles naming more of the channel's topics first, then the newest.
        const list = [...stories.news.values()]
          .map(n => ({ ...n, topics: n.topics.filter(k => scopeKeys.has(k)) }))
          .filter(n => n.topics.length)
          .sort((a, b) => b.topics.length - a.topics.length || b.t - a.t);
        const newest = Math.max(...list.map(n => n.t), 0),
          oldest = Math.min(...list.map(n => n.t), newest);
        items = list.slice(0, 12).map(n => ({
          n,
          topics: topicsOf(n.topics),
          pct: newest > oldest ? 15 + ((n.t - oldest) / (newest - oldest)) * 85 : 100,
        }));
        meta = at ? `checked ${ago(at)} · ${list.length} Guardian articles name your topics` : '';
        empty = 'No recent Guardian articles name these topics.';
      } else if (src === 'reading') {
        // Posts naming a topic rank by match strength; the rest still show, lower, as "new".
        const rank = (r: ReadingMatch) => {
          const n = r.topics.filter(k => scopeKeys.has(k)).length;
          return (n ? r.score : 0.4) * fade(r.t);
        };
        const list = [...stories.reading.values()].sort((a, b) => rank(b) - rank(a) || b.t - a.t);
        const top = Math.max(1e-6, ...list.slice(0, 12).map(rank));
        const matched = list.filter(r => r.topics.some(k => scopeKeys.has(k))).length;
        items = list.slice(0, 12).map(r => ({ r, topics: topicsOf(r.topics), pct: (rank(r) / top) * 100 }));
        meta = at ? `${matched} of ${stories.readingCount} posts name your topics` : '';
        empty = 'Nothing from the sites you follow yet.';
      } else if (src === 'forecasts') {
        const list = [...stories.forecasts.values()]
          .filter(f => f.topics.some(k => scopeKeys.has(k)))
          .sort((a, b) => b.vol24 - a.vol24 || b.bettors - a.bettors);
        items = list.slice(0, 12).map(f => ({ f, topics: topicsOf(f.topics), pct: f.prob * 100 }));
        meta = at ? `checked ${ago(at)} · open markets on Manifold` : '';
        empty = 'No open forecast (10+ forecasters) names these topics.';
      } else {
        let list = [...stories.hn.values()].filter(s => s.topics.some(k => scopeKeys.has(k)));
        list.sort((a, b) => b.vel - a.vel);
        if (state.storyScope !== 'topic') {
          const per = {};
          list = list.filter(s => (per[s.topics[0]] = (per[s.topics[0]] || 0) + 1) <= 3);
        }
        const p80 = quantile(
            list.map(s => s.vel),
            0.8,
          ),
          vmax = Math.max(1, ...list.map(s => s.vel));
        items = list.slice(0, 12).map(s => ({
          s,
          topics: topicsOf(s.topics),
          breaking: s.age < 8 && s.vel >= p80 && list.length >= 5,
          pct: (s.vel / vmax) * 100,
        }));
        meta = at ? `checked ${ago(at)} · ranked by engagement per hour` : '';
        empty = 'No Hacker News stories in the last 48 h for these topics (English topics only).';
      }
      return {
        src,
        fixedSites: !!activeChannel().sites?.length,
        items,
        meta: loading ? 'loading…' : meta,
        empty: loading ? 'Loading…' : err && !items.length ? `Could not load: ${err}.` : empty,
        warn: err && items.length ? `Some sources failed: ${err}.` : '',
      };
    });
    async function follow() {
      if (!newSite.value.trim()) return;
      adding.value = true;
      siteMsg.value = (await addReadingSite(newSite.value)) || '';
      adding.value = false;
      if (!siteMsg.value) newSite.value = '';
    }
    const TABS = [
      ['news', 'The Guardian'],
      ['reading', 'Reading'],
      ['forecasts', 'Forecasts'],
      ['hn', 'Hacker News'],
    ];
    const SCOPES = [
      ['topic', 'This topic'],
      ['lens', 'Whole channel'],
    ];
    // The Guardian tab appears once a key is set.
    const tabs = computed(() => {
      ui.v;
      const c = activeChannel();
      // A channel that reads one site names the tab after it ("The Great Simplification").
      const only = c.sites?.length === 1 ? readingSites().find(x => x.url === c.sites[0])?.name : '';
      return c.streams
        .filter(id => id !== 'news' || ui.guardian)
        .map(id => TABS.find(t => t[0] === id))
        .filter(Boolean)
        .map(([id, label]) => [id, id === 'reading' && only ? only : label]);
    });
    const when = (t: number) =>
      Math.abs(Date.now() - t) < 30 * DAY_MS
        ? ago(t)
        : new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    return {
      ui,
      state,
      view,
      sites,
      newSite,
      siteMsg,
      adding,
      follow,
      unfollow: removeReadingSite,
      tabs,
      SCOPES,
      setStorySource,
      setStoryScope,
      when,
    };
  },
});
</script>
