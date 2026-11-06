<template>
  <panel-shell id="p-stories" title="Matched to your topics" :meta="view.meta" :index="index">
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
        <button
          v-if="!isBuiltInSite(s.url)"
          type="button"
          :aria-label="'Stop following ' + s.name"
          @click="unfollow(s.url)"
        >
          ×
        </button>
      </span>
      <form class="site-add" autocomplete="off" @submit.prevent="follow">
        <label class="sr-only" for="site-input">Follow a WordPress site</label>
        <input id="site-input" v-model="newSite" placeholder="+ follow a site (WordPress)" :disabled="adding" />
      </form>
      <span v-if="siteMsg" class="muted err">{{ siteMsg }}</span>
    </div>

    <ol class="stories">
      <li v-for="(r, i) in view.rows" :key="r.id" class="story">
        <span class="rank">{{ i + 1 }}</span>
        <div>
          <div class="title">
            <a :href="r.url" target="_blank" rel="noopener noreferrer">{{ r.title }}</a>
          </div>
          <div class="smeta">
            <span v-for="E in topicsOf(r.topics)" :key="E.key" class="stopic">
              <topic-dot :color="E.color"></topic-dot>
              {{ E.name }}
            </span>
            <template v-for="(p, k) in r.meta" :key="k">
              <span v-if="typeof p === 'string'">{{ p }}</span>
              <a v-else-if="p.href" :href="p.href" :class="p.cls" target="_blank" rel="noopener noreferrer">
                {{ p.text }}
              </a>
              <span v-else :class="p.cls">{{ p.text }}</span>
            </template>
          </div>
        </div>
        <div class="vel">
          <template v-if="r.side.big">
            <b>{{ r.side.big }}</b>
            {{ r.side.unit }}
          </template>
          <small>{{ r.side.note }}</small>
          <div class="vbar"><i :style="{ width: r.bar.toFixed(1) + '%' }"></i></div>
        </div>
      </li>
      <li v-if="!view.rows.length" class="empty">{{ view.empty }}</li>
      <li v-if="view.warn" class="empty">{{ view.warn }}</li>
    </ol>
  </panel-shell>
</template>

<script lang="ts">
import { useApp } from '@/context';
import { computed, defineComponent, ref } from 'vue';
import type { Entry, Prefs } from '@/types';
import { channelStreams, streamContext } from '@features/stories';
import { isBuiltInSite, readingSites } from '@sources/reading';
import { streamById } from '@sources/streams';
import { activeChannel } from '@/channels';
import TopicDot from '@components/TopicDot.vue';
import PanelShell from '@components/PanelShell.vue';

// PRECOG / Trend Radar · Streams: one tab per stream the channel shows (news, followed sites, forecasts,
// Hacker News…), each a ranked list of items naming the topics in scope. Every stream's rows look alike.

const SCOPES: [Prefs['storyScope'], string][] = [
  ['topic', 'This topic'],
  ['lens', 'Whole channel'],
];

export default defineComponent({
  name: 'StoriesPanel',
  props: { index: Number },
  components: { PanelShell, TopicDot },
  setup() {
    const { app, stories: loader, actions } = useApp();
    const stories = loader.status;
    const { addReadingSite, removeReadingSite, setStoryScope, setStorySource } = actions;
    const { state } = app;
    const newSite = ref(''),
      siteMsg = ref(''),
      adding = ref(false);
    const sites = computed(() => readingSites());
    const view = computed(() => {
      const src = state.storySrc,
        stream = streamById(src),
        ctx = streamContext(app);
      const loading = !!stories.loading[src],
        data = stories.data[src],
        err = stories.errors[src] || stream?.warning?.(data) || null,
        out = stream?.view(ctx, data, stories.at[src] || 0) ?? { rows: [], meta: '', empty: '' };
      const n = out.rows.length;
      return {
        src,
        fixedSites: !!activeChannel(app).sites?.length,
        rows: out.rows,
        meta: loading ? 'loading…' : out.meta,
        empty: loading ? 'Loading…' : err && !n ? `Could not load: ${err}.` : out.empty,
        warn: err && n ? `Some sources failed: ${err}.` : '',
      };
    });
    /** Up to two topics in scope that an item names, as chips. */
    const topicsOf = (keys: string[]): Entry[] => {
      const scope = new Set(streamContext(app).scopeKeys);
      return keys
        .filter(k => scope.has(k))
        .map(k => state.rt.get(k))
        .filter((E): E is Entry => !!E)
        .slice(0, 2);
    };
    async function follow() {
      if (!newSite.value.trim()) return;
      adding.value = true;
      siteMsg.value = (await addReadingSite(newSite.value)) || '';
      adding.value = false;
      if (!siteMsg.value) newSite.value = '';
    }
    // One tab per stream the channel shows (a stream can hide itself, e.g. until its API key is set).
    const tabs = computed(() => {
      const ctx = streamContext(app);
      return channelStreams(app).map(s => [s.id, s.tabLabel?.(ctx) ?? s.label] as const);
    });
    return {
      state,
      view,
      sites,
      isBuiltInSite,
      newSite,
      siteMsg,
      adding,
      follow,
      unfollow: removeReadingSite,
      tabs,
      topicsOf,
      SCOPES,
      setStorySource,
      setStoryScope,
    };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
/* stories */
.stories {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.story {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  gap: 4px 10px;
  padding: 9px 0;
  border-bottom: 1px solid var(--hair);
  align-items: start;
}
.story:last-child {
  border-bottom: 0;
}
.story .rank {
  font: 500 18px/1.1 var(--sans);
  color: var(--muted);
  text-align: right;
}
.story .title {
  font-weight: 600;
  line-height: 1.35;
}
.story .smeta {
  color: var(--muted);
  font-size: 11.5px;
  margin-top: 3px;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  align-items: center;
}
.story .stopic {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ink-2);
}
.story .stopic .dot {
  width: 8px;
  height: 8px;
}
.story .vel {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.story .vel b {
  font: 500 18px/1 var(--sans);
}
.story .vel small {
  display: block;
  color: var(--muted);
  font-size: 10.5px;
  margin-top: 3px;
}
.vbar {
  height: 4px;
  border-radius: 4px;
  background: var(--track);
  margin-top: 5px;
  overflow: hidden;
  width: 90px;
  margin-left: auto;
}
.vbar i {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: var(--ink-2);
}
/* Phones: the figure moves under the title as one line, so titles get the full width. */
@media (max-width: 600px) {
  .story {
    grid-template-columns: 22px minmax(0, 1fr);
  }
  .story .vel {
    grid-column: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    text-align: left;
    white-space: normal;
  }
  .story .vel b {
    font-size: 15px;
  }
  .story .vel small {
    display: inline;
    margin-top: 0;
  }
  .story .vel .vbar {
    width: 56px;
    margin: 0;
    align-self: center;
  }
}
.flag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 1px 6px;
  border-radius: 5px;
  border: 1.5px solid var(--ink);
  color: var(--ink);
}
/* reading: followed sites */
.sites {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin: -2px 0 10px;
  font-size: 11.5px;
}
.site-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--hair);
  background: var(--card);
  border-radius: 999px;
  padding: 2px 4px 2px 10px;
}
.site-chip a {
  text-decoration: none;
}
.site-chip button {
  border: 0;
  background: transparent;
  color: var(--muted);
  width: 20px;
  height: 20px;
  border-radius: 50%;
}
.site-chip button:hover {
  background: var(--track);
  color: var(--ink);
}
.site-add input {
  border: 1px dashed var(--axis);
  background: transparent;
  border-radius: 999px;
  padding: 3px 12px;
  width: 230px;
  max-width: 100%;
}
.smeta .site {
  color: var(--accent);
}
.smeta .desc {
  color: var(--muted);
  flex-basis: 100%;
}
</style>
