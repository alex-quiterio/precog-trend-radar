<template>
  <panel-shell id="p-stories" title="Rising stories" :meta="view.meta" :index="index" :data-tick="ui.v">
    <template #controls>
      <span class="seg no-print" role="group" aria-label="Story source">
        <button
          v-for="[id, label] in view.tabs"
          :key="id"
          type="button"
          :aria-pressed="state.storySrc === id"
          @click="setStorySource(id)"
        >
          {{ label }}
        </button>
      </span>
      <span class="seg no-print" role="group" aria-label="Story scope">
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
    <ol class="stories">
      <li v-if="view.needsFeeds" class="empty">
        Portuguese and Dutch outlets (RTP, Público, Observador, NOS, NU.nl, DutchNews, NL Times) block direct browser
        access. Run the bundled proxy (
        <code>npm run proxy</code>
        ), then
        <button class="btn small" type="button" @click="openFeeds('local')">set up PT + NL feeds</button>
      </li>
      <template v-else-if="view.src === 'hn'">
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
        <li v-if="!view.items.length" class="empty">{{ view.empty }}</li>
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
        <li v-if="!view.items.length" class="empty">{{ view.empty }}</li>
      </template>
      <template v-else-if="view.src === 'tgs'">
        <li v-for="(it, i) in view.items" :key="it.e.id" class="story">
          <span class="rank">{{ i + 1 }}</span>
          <div>
            <div class="title">
              <a :href="it.e.url" target="_blank" rel="noopener noreferrer">{{ it.e.title }}</a>
            </div>
            <div class="smeta">
              <span v-for="E in it.topics" :key="E.key" class="stopic">
                <topic-dot :color="E.color"></topic-dot>
                {{ E.name }}
              </span>
              <span>{{ it.e.kind }}{{ it.e.num ? ' #' + it.e.num : '' }}</span>
              <span>{{ when(it.e.t) }}</span>
            </div>
          </div>
          <div class="vel">
            <b>{{ it.e.topics.length }}</b>
            {{ it.e.topics.length === 1 ? 'topic' : 'topics' }}
            <small>{{ it.e.score >= 3 ? 'in the title' : 'in the description' }}</small>
            <div class="vbar"><i :style="{ width: it.pct.toFixed(1) + '%' }"></i></div>
          </div>
        </li>
        <li v-if="!view.items.length" class="empty">{{ view.empty }}</li>
      </template>
      <template v-else>
        <li v-for="(it, i) in view.items" :key="it.c.id" class="story">
          <span class="rank">{{ i + 1 }}</span>
          <div>
            <div class="title">
              <a :href="it.c.url" target="_blank" rel="noopener noreferrer">{{ it.c.title }}</a>
            </div>
            <div class="smeta">
              <span v-for="E in it.topics" :key="E.key" class="stopic">
                <topic-dot :color="E.color"></topic-dot>
                {{ E.name }}
              </span>
              <span>{{ it.c.domain }}</span>
              <span>first seen {{ isFinite(it.c.first) ? ago(it.c.first) : '—' }}</span>
              <span v-if="!view.isLocal">
                {{ it.c.countries.size }} {{ it.c.countries.size === 1 ? 'country' : 'countries' }}
              </span>
            </div>
          </div>
          <div class="vel">
            <b>{{ it.c.domains.size }}</b>
            {{ it.c.domains.size === 1 ? 'outlet' : 'outlets' }}
            <small>last {{ view.isLocal ? 48 : 24 }} h</small>
            <div class="vbar"><i :style="{ width: it.pct.toFixed(1) + '%' }"></i></div>
          </div>
        </li>
        <li v-if="!view.items.length" class="empty">{{ view.empty }}</li>
        <li v-if="view.warn" class="empty">{{ view.warn }}</li>
      </template>
    </ol>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import type { Entry } from '../types';
import type { ForecastMatch, HNStory, StoryCluster, TGSMatch } from '../features/stories';
import { openFeeds, setStoryScope, setStorySource } from '../actions';
import { ago } from '../core/format';
import { quantile } from '../core/stats';
import { ui } from '../core/ui-store';
import { stories, storyScopeEntries, storyTabs } from '../features/stories';
import { state } from '../state';
import TopicDot from './TopicDot.vue';
import PanelShell from './PanelShell.vue';

// PRECOG / Trend Radar · Rising stories: HN engagement velocity, GDELT and PT·NL story clusters, and
// The Great Simplification episodes that touch your topics.

interface StoryItem {
  s?: HNStory;
  c?: StoryCluster;
  e?: TGSMatch;
  f?: ForecastMatch;
  topics: Entry[];
  breaking?: boolean;
  pct: number;
}
interface StoriesView {
  src: string;
  tabs?: string[][];
  meta: string;
  isLocal?: boolean;
  needsFeeds?: boolean;
  items?: StoryItem[];
  empty?: string;
  warn?: string;
}

export default defineComponent({
  name: 'StoriesPanel',
  props: { index: Number },
  components: { PanelShell, TopicDot },
  setup() {
    const view = computed((): StoriesView => {
      ui.v;
      const tabs = storyTabs().map(id => [id, TAB_LABEL[id]]);
      return { ...build(), tabs };
    });
    const build = (): StoriesView => {
      const src = state.storySrc,
        isLocal = src === 'local';
      const scopeKeys = new Set(storyScopeEntries().map(E => E.key));
      const inScope = (s: { topics: string[] }) => s.topics.some(k => scopeKeys.has(k));
      const topicsOf = (s: { topics: string[] }) =>
        s.topics
          .map(k => state.rt.get(k))
          .filter(Boolean)
          .slice(0, 2);
      if (src === 'hn') {
        let list: HNStory[] = [...stories.hn.values()].filter(inScope);
        list.sort((a, b) => b.vel - a.vel);
        if (state.storyScope !== 'topic') {
          const per = {};
          list = list.filter(s => {
            const k = s.topics[0];
            per[k] = (per[k] || 0) + 1;
            return per[k] <= 3;
          });
        }
        const p80 = quantile(
            list.map(s => s.vel),
            0.8,
          ),
          vmax = Math.max(1, ...list.map(s => s.vel));
        return {
          src,
          meta: stories.loading.hn
            ? 'loading…'
            : stories.at.hn
              ? `checked ${ago(stories.at.hn)} · ranked by engagement/hour`
              : '',
          items: list.slice(0, 12).map(s => ({
            s,
            topics: topicsOf(s),
            breaking: s.age < 8 && s.vel >= p80 && list.length >= 5,
            pct: (s.vel / vmax) * 100,
          })),
          empty: stories.loading.hn
            ? 'Loading stories…'
            : stories.errors.hn
              ? `Could not load: ${stories.errors.hn}`
              : 'No Hacker News stories in the last 48 h for this scope.',
        };
      }
      if (src === 'forecasts') {
        // Busiest markets first: today's trading, then how many people forecast.
        const list: ForecastMatch[] = [...stories.forecasts.values()]
          .map(f => ({ ...f, topics: f.topics.filter(k => scopeKeys.has(k)) }))
          .filter(f => f.topics.length)
          .sort((a, b) => b.vol24 - a.vol24 || b.bettors - a.bettors);
        return {
          src,
          meta: stories.loading.forecasts
            ? 'loading markets…'
            : stories.at.forecasts
              ? `checked ${ago(stories.at.forecasts)} · open markets on Manifold · crowd probability`
              : '',
          items: list.slice(0, 12).map(f => ({ f, topics: topicsOf(f), pct: f.prob * 100 })),
          empty: stories.loading.forecasts
            ? 'Loading forecasts…'
            : stories.errors.forecasts
              ? `Could not load: ${stories.errors.forecasts}.`
              : 'No open forecast (10+ forecasters) names these topics.',
        };
      }
      if (src === 'tgs') {
        // Match strength (title hits count triple) fading with age: halves every 6 months,
        // so a fresh episode beats an old one that names one more topic.
        const rank = (e: TGSMatch) => e.score * 0.5 ** ((Date.now() - e.t) / (182 * 86400e3));
        const list: TGSMatch[] = [...stories.tgs.values()]
          .map(e => ({ ...e, topics: e.topics.filter(k => scopeKeys.has(k)) }))
          .filter(e => e.topics.length)
          .sort((a, b) => rank(b) - rank(a) || b.t - a.t);
        const smax = Math.max(1, ...list.map(e => e.score));
        return {
          src,
          meta: stories.loading.tgs
            ? 'loading the catalogue…'
            : stories.at.tgs
              ? `${list.length} of ${stories.tgsCount} episodes match · thegreatsimplification.com`
              : '',
          items: list.slice(0, 12).map(e => ({ e, topics: topicsOf(e), pct: (e.score / smax) * 100 })),
          empty: stories.loading.tgs
            ? 'Loading The Great Simplification catalogue…'
            : stories.errors.tgs
              ? `Could not load: ${stories.errors.tgs}.`
              : 'No episode or Frankly of The Great Simplification mentions these topics yet.',
        };
      }
      const list: StoryCluster[] = [...stories[src as 'news' | 'local'].values()].filter(inScope);
      list.sort((a, b) => b.domains.size - a.domains.size || b.first - a.first);
      const dmax = Math.max(1, ...list.map(c => c.domains.size));
      return {
        src,
        isLocal,
        needsFeeds: isLocal && stories.errors.local === 'nofeeds',
        meta: stories.loading[src]
          ? isLocal
            ? 'loading feeds…'
            : 'loading (≈6 s per request)…'
          : stories.at[src]
            ? `checked ${ago(stories.at[src])} · ranked by outlets covering`
            : '',
        items: list.slice(0, 12).map(c => ({ c, topics: topicsOf(c), pct: (c.domains.size / dmax) * 100 })),
        empty: stories.loading[src]
          ? isLocal
            ? 'Loading local feeds…'
            : 'Loading global news (GDELT allows one request every ~5 s)…'
          : stories.errors[src]
            ? `${isLocal ? 'Local feeds' : 'Global news unavailable'}: ${stories.errors[src]}.`
            : `No matching stories in the last ${isLocal ? 48 : 24} h for this scope.`,
        warn: isLocal && list.length && stories.errors.local ? stories.errors.local : '',
      };
    };
    const TAB_LABEL = {
      hn: 'Hacker News',
      news: 'Global news',
      local: 'PT · NL news',
      forecasts: 'Forecasts',
      tgs: 'Great Simplification',
    };
    const when = (t: number) =>
      Math.abs(Date.now() - t) < 30 * 86400e3
        ? ago(t)
        : new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const SCOPES = [
      ['topic', 'Topic'],
      ['lens', 'Lens'],
      ['all', 'All'],
    ];
    return { ui, state, view, SCOPES, setStorySource, setStoryScope, openFeeds, when };
  },
});
</script>
