<template>
  <panel-shell id="p-digest" title="Today’s stories" :meta="meta" :index="index">
    <ol v-if="stories.length" class="dg">
      <li v-for="(d, i) in stories" :key="d.key" class="dg-item" :class="{ lead: i === 0 }">
        <span class="dg-no" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
        <div class="dg-body">
          <div class="dg-top">
            <button type="button" class="dg-topic" :title="'Chart ' + d.E.name" @click="select(d.E.key)">
              <topic-dot :color="d.E.color"></topic-dot>
              {{ d.E.name }}
            </button>
            <span class="dg-flag">{{ d.source }}{{ d.t ? ' · ' + ago(d.t, ui.now) : '' }}</span>
            <week-move :d="d"></week-move>
          </div>
          <a class="dg-text" :href="d.url" target="_blank" rel="noopener noreferrer">{{ d.text }}</a>
          <div class="dg-foot">
            <span v-if="d.why">{{ d.why }}</span>
            <a v-if="d.kind === 'headline'" :href="d.wiki" target="_blank" rel="noopener noreferrer">Background ↗</a>
            <a :href="d.coverage" target="_blank" rel="noopener noreferrer">This week’s coverage ↗</a>
          </div>
        </div>
      </li>
    </ol>

    <template v-if="quiet.length">
      <h4 class="dg-sub">{{ stories.length ? 'Also moving, no fresh story' : 'Moving, but no fresh story yet' }}</h4>
      <ul class="dg dg-quiet">
        <li v-for="d in quiet" :key="d.key">
          <button type="button" class="dg-topic" :title="'Chart ' + d.E.name" @click="select(d.E.key)">
            <topic-dot :color="d.E.color"></topic-dot>
            {{ d.E.name }}
          </button>
          <a class="dg-what" :href="d.url" target="_blank" rel="noopener noreferrer">{{ d.text }}</a>
          <week-move :d="d"></week-move>
        </li>
      </ul>
    </template>

    <template v-if="latest.length">
      <h4 class="dg-sub">{{ latestTitle }}</h4>
      <ul class="dg dg-latest">
        <li v-for="p in latest" :key="p.id">
          <a class="dg-head" :href="p.url" target="_blank" rel="noopener noreferrer">{{ p.title }}</a>
          <span class="dg-when">{{ p.site }} · {{ ago(p.t, ui.now) }}</span>
        </li>
      </ul>
    </template>

    <ul v-if="!items.length && loading" class="dg dg-wait" aria-label="Loading today’s stories">
      <li v-for="n in 3" :key="n">
        <i></i>
        <i></i>
      </li>
    </ul>
    <p v-else-if="!items.length && !latest.length" class="dg-empty">
      {{ error ? 'Could not load: ' + error : 'No stories for these topics yet.' }}
    </p>
  </panel-shell>
</template>

<script lang="ts">
import { useApp } from '@/context';
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, shallowRef, watch, type PropType } from 'vue';
import { errorText, isAbort } from '@core/errors';
import { ago, nf0 } from '@core/format';
import {
  type DigestData,
  type DigestItem,
  type StoryScope,
  digestItems,
  latestPosts,
  loadDigest,
  sitePosts,
} from '@sources/wikipedia/digest';
import { type ReadingItem, siteByUrl } from '@sources/reading';
import { activeChannel } from '@/channels';
import PanelShell from '@components/PanelShell.vue';
import TopicDot from '@components/TopicDot.vue';

// PRECOG / Trend Radar · Today's stories: what is happening with each of the channel's topics. Stories (from
// Wikipedia's "In the news", or a fresh Guardian headline; on a scoped channel, a post from its own sites) are told in a sentence, the lead one set large;
// topics whose attention moved without a fresh story get one quiet line saying what they are. Each says how
// far its attention moved in a week and, on World, why it was picked.

const signedPct = (p: number): string => `${p >= 0 ? '+' : '−'}${nf0.format(Math.abs(p))}%`;
/** A topic's move in a week: ▲ +120% this week. */
const WeekMove = defineComponent({
  name: 'WeekMove',
  props: { d: { type: Object as PropType<DigestItem>, required: true } },
  setup: props => () =>
    props.d.week == null
      ? null
      : h(
          'span',
          {
            class: ['dg-week', props.d.week >= 0 ? 'up' : 'down'],
            title: `Attention now ${props.d.now == null ? '–' : Math.round(props.d.now)} (100 = its 30-day norm), ${signedPct(props.d.week)} on a week ago`,
          },
          [`${props.d.week >= 0 ? '▲' : '▼'} ${signedPct(props.d.week)} `, h('small', 'week')],
        ),
});

export default defineComponent({
  name: 'DigestPanel',
  components: { PanelShell, TopicDot, WeekMove },
  props: { index: { type: Number, default: 0 } },
  setup() {
    const { app, hot, actions } = useApp();
    const ui = app.ui;
    const data = shallowRef<DigestData>();
    const posts = shallowRef<ReadingItem[]>([]);
    const channel = computed(() => activeChannel(app));
    const toSites = (urls: string[]) => urls.map(siteByUrl).filter(s => !!s);
    /** The channel's own story sources, if it scopes its stories (see `stories` in channels.ts). */
    const scope = (): StoryScope | undefined => {
      const st = channel.value.stories;
      return st ? { sites: toSites(st.sites), days: st.days ?? 2 } : undefined;
    };
    const loading = ref(false),
      error = ref(''),
      at = ref(0);
    const entries = () => app.entriesOf(app.activeLens());
    let abort: AbortController | null = null;

    async function load(): Promise<void> {
      abort?.abort();
      const ac = (abort = new AbortController());
      loading.value = true;
      try {
        const sc = scope();
        const latestSites = toSites(channel.value.stories?.latest?.sites ?? []);
        posts.value = [];
        const [out, latest] = await Promise.all([
          loadDigest(
            entries(),
            ac.signal,
            partial => {
              if (!ac.signal.aborted) data.value = partial;
            },
            sc,
          ),
          sitePosts(latestSites, ac.signal),
        ]);
        if (ac.signal.aborted) return;
        posts.value = latest;
        data.value = out;
        error.value = '';
        at.value = Date.now();
      } catch (e) {
        if (!isAbort(e) && !ac.signal.aborted) error.value = errorText(e);
      } finally {
        if (abort === ac) loading.value = false;
      }
    }
    // Reload when the channel's topics change (World picks new ones each morning).
    const keys = computed(() =>
      entries()
        .map(E => E.key)
        .join('|'),
    );
    watch(keys, () => void load());
    onMounted(() => void load());
    onBeforeUnmount(() => abort?.abort());

    const items = computed(() => {
      const list = entries();
      const byKey = new Map(list.map(E => [E.key, E]));
      return digestItems(list, data.value, ui.now, scope()).map(d => {
        const E = byKey.get(d.key)!;
        const pick = hot.for(E.lensId)?.pickOf(E.name);
        return { ...d, E, why: pick?.why && pick.echoes.length ? `Picked for: ${pick.why}` : '' };
      });
    });
    const meta = computed(() => (at.value ? `checked ${ago(at.value, ui.now)}` : loading.value ? 'reading…' : ''));
    const latest = computed(() => {
      const st = channel.value.stories;
      if (!st?.latest) return [];
      const told = new Set(items.value.filter(d => d.kind !== 'quiet').map(d => d.url));
      return latestPosts(posts.value, told, ui.now, st.days ?? 2);
    });
    return {
      ui,
      items,
      latest,
      latestTitle: computed(() => channel.value.stories?.latest?.title ?? ''),
      stories: computed(() => items.value.filter(d => d.kind !== 'quiet')),
      quiet: computed(() => items.value.filter(d => d.kind === 'quiet')),
      loading,
      error,
      meta,
      ago,
      select: actions.select,
    };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
.dg {
  list-style: none;
  margin: 0;
  padding: 0;
}
.dg-item {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 4px 10px;
  padding: 14px 0;
  border-top: 1px solid var(--hair);
}
.dg-item:first-child {
  border-top: 0;
  padding-top: 2px;
}
.dg-no {
  font: 600 12px/1.9 var(--mono);
  color: var(--muted);
}
.lead .dg-no {
  color: var(--accent);
}
.dg-body {
  min-width: 0;
}
.dg-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-bottom: 6px;
  font-size: 11.5px;
}
.dg-topic {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  border: 0;
  background: none;
  color: var(--ink-2);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.dg-topic:hover {
  color: var(--ink);
}
.dg-flag {
  padding: 1px 8px;
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}
@keyframes dg-pulse {
  50% {
    opacity: 0.3;
  }
}
.dg-week {
  margin-left: auto;
  font: 600 12px var(--mono);
  white-space: nowrap;
}
.dg-week small {
  font: 400 10.5px var(--sans);
  color: var(--muted);
}
.dg-week.up {
  color: var(--accent);
}
.dg-week.down {
  color: var(--muted);
}
.dg-text {
  display: block;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.45;
  font-weight: 500;
  text-decoration: none;
  text-wrap: pretty;
}
.dg-text:hover,
.dg-what:hover {
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-underline-offset: 3px;
}
.lead .dg-text {
  font-size: 19px;
  line-height: 1.35;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.dg-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-top: 8px;
  font-size: 11.5px;
  color: var(--muted);
}
.dg-foot a {
  color: var(--ink-2);
  text-decoration: none;
  padding: 2px 0;
}
.dg-foot a:hover {
  color: var(--accent);
}
.dg-sub {
  margin: 14px 0 4px;
  padding-top: 12px;
  border-top: 1px solid var(--hair);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.dg-quiet li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 10px;
  padding: 6px 0;
}
.dg-what {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
  font-size: 12.5px;
  text-decoration: none;
}
.dg-wait li {
  padding: 14px 0 14px 36px;
  border-top: 1px solid var(--hair);
}
.dg-wait li:first-child {
  border-top: 0;
}
.dg-wait i {
  display: block;
  height: 12px;
  margin: 6px 0;
  border-radius: 6px;
  background: var(--track);
  animation: dg-pulse 1.6s ease-in-out infinite;
}
.dg-wait i + i {
  width: 70%;
}
.dg-latest li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  padding: 6px 0;
}
.dg-head {
  flex: 1 1 260px;
  min-width: 0;
  color: var(--ink);
  font-size: 13.5px;
  line-height: 1.4;
  text-decoration: none;
}
.dg-head:hover {
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-underline-offset: 3px;
}
.dg-when {
  color: var(--muted);
  font-size: 11.5px;
  white-space: nowrap;
}
.dg-empty {
  margin: 0;
  color: var(--muted);
}
@media (max-width: 560px) {
  .dg-item {
    grid-template-columns: 20px minmax(0, 1fr);
    gap: 4px 8px;
  }
  .lead .dg-text {
    font-size: 17.5px;
  }
  .dg-wait li {
    padding-left: 28px;
  }
}
</style>
