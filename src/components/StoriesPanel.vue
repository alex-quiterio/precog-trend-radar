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
import { computed, defineComponent, ref } from 'vue';
import type { Entry, Prefs } from '@/types';
import { addReadingSite, removeReadingSite, setStoryScope, setStorySource } from '@/actions';
import { channelStreams, stories, streamContext } from '@features/stories';
import { isBuiltInSite, readingSites } from '@sources/reading';
import { streamById } from '@sources/streams';
import { state } from '@/state';
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
    const newSite = ref(''),
      siteMsg = ref(''),
      adding = ref(false);
    const sites = computed(() => readingSites());
    const view = computed(() => {
      const src = state.storySrc,
        stream = streamById(src),
        ctx = streamContext();
      const loading = !!stories.loading[src],
        err = stories.errors[src] || stream?.warning?.() || null,
        out = stream?.view(ctx, stories.at[src] || 0) ?? { rows: [], meta: '', empty: '' };
      const n = out.rows.length;
      return {
        src,
        fixedSites: !!activeChannel().sites?.length,
        rows: out.rows,
        meta: loading ? 'loading…' : out.meta,
        empty: loading ? 'Loading…' : err && !n ? `Could not load: ${err}.` : out.empty,
        warn: err && n ? `Some sources failed: ${err}.` : '',
      };
    });
    /** Up to two topics in scope that an item names, as chips. */
    const topicsOf = (keys: string[]): Entry[] => {
      const scope = new Set(streamContext().scopeKeys);
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
      const ctx = streamContext();
      return channelStreams().map(s => [s.id, s.tabLabel?.(ctx) ?? s.label] as const);
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
