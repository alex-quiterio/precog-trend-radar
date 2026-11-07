<template>
  <panel-shell id="p-watch" title="Topics" :meta="view.meta" :index="index">
    <template #controls>
      <button
        v-if="view.own && view.lens"
        class="btn small no-print"
        type="button"
        :aria-label="'Delete channel ' + view.lens.name"
        @click="removeLens(view.lens.id)"
      >
        Delete channel
      </button>
    </template>
    <div class="watch-row">
      <span
        v-for="E in view.list"
        :key="E.key"
        class="chip"
        :class="{ sel: view.sel === E, pinned: view.hot && hotOf(E)?.pinned }"
      >
        <button class="name" type="button" :aria-pressed="view.sel === E" :title="chipTitle(E)" @click="select(E.key)">
          <topic-dot :color="E.color"></topic-dot>
          {{ E.name }}
          <span v-if="view.hot && isNew(E)" class="hot-new">new</span>
        </button>
        <button
          v-if="view.hot"
          class="pin no-print"
          type="button"
          :aria-pressed="!!hotOf(E)?.pinned"
          :aria-label="(hotOf(E)?.pinned ? 'Unpin ' : 'Pin ') + E.name"
          :title="hotOf(E)?.pinned ? 'Pinned: it stays. Click to let it go.' : 'Pin: keep it here'"
          @click="togglePin(E.key)"
        >
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
            <path
              d="M4.5 1.5h3l-.5 3 2 1.5v1H3v-1l2-1.5zM6 7v3.5"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linejoin="round"
              :fill="hotOf(E)?.pinned ? 'currentColor' : 'none'"
            />
          </svg>
        </button>
        <button class="x" type="button" :aria-label="'Remove ' + E.name" @click="removeTopic(E.key)">×</button>
      </span>
      <form v-if="!view.full" class="add-form" autocomplete="off" @submit.prevent="submitTopic">
        <label class="sr-only" for="add-input">Add a topic to {{ view.lens ? view.lens.name : '' }}</label>
        <input
          id="add-input"
          ref="addInput"
          v-model="newTopic"
          type="text"
          maxlength="120"
          placeholder="+ topic  (or: Name | wiki: Title | q: query)"
        />
      </form>
    </div>
    <p v-if="view.hot && view.echo" class="hot-why">
      <span v-for="e in view.echo.tags" :key="e.id" class="echo" :title="e.title">{{ e.label }}</span>
      <span class="why">{{ view.echo.why }}</span>
    </p>
    <p class="watch-msg" :class="{ err: ui.watchErr }" role="status">{{ ui.watchMsg }}</p>
  </panel-shell>
</template>

<script lang="ts">
import { useApp } from '@/context';
import { ref, computed, watch, nextTick, defineComponent } from 'vue';
import { isBuiltInLens } from '@/channels';
import { MAX_TOPICS } from '@core/config';
import type { Entry } from '@/types';
import { ECHO_LABEL, type Echo, dayOf } from '@features/hot-topics';
import TopicDot from '@components/TopicDot.vue';
import PanelShell from '@components/PanelShell.vue';

// PRECOG / Trend Radar · Topics of the channel on screen: pick one to chart, add or remove topics.
// On World and Alt Amsterdam the topics are picked each day (from what the internet is echoing, or what is
// moving in the scene): pin one to keep it, and the
// line under the topics says where the selected one is echoing.

export default defineComponent({
  name: 'LensPanel',
  props: { index: Number },
  components: { PanelShell, TopicDot },
  setup() {
    const { app, actions, hot } = useApp();
    const ui = app.ui;
    const { addTopic, removeLens, removeTopic, select, togglePin } = actions;
    const hotOf = (E: Entry) => hot.for(E.lensId)?.pickOf(E.name);
    const isNew = (E: Entry) => !!hot.for(E.lensId)?.isNew(hotOf(E), dayOf(ui.now));
    const SHORT: Record<Echo, string> = {
      news: 'In the news',
      read: 'Most read',
      hn: 'Hacker News',
      manifold: 'Manifold',
      guardian: 'Guardian',
      views: 'Rising on Wikipedia',
      sites: 'In the channel’s sites',
    };
    const newTopic = ref(''),
      addInput = ref<HTMLInputElement | null>(null);
    const view = computed(() => {
      const lens = app.activeLens(),
        list = app.entriesOf(lens);
      const picker = hot.for(lens?.id);
      const isHot = !!picker;
      const sel = app.selectedEntry();
      const p = sel && isHot ? hotOf(sel) : undefined;
      const hs = picker?.state;
      return {
        hot: isHot,
        echo: p && {
          tags: p.echoes.map(e => ({ id: e, label: SHORT[e], title: ECHO_LABEL[e] })),
          why:
            p.why ||
            (p.echoes.includes('news')
              ? 'On the front page of Wikipedia, chosen by its editors.'
              : p.pinned
                ? 'Pinned by you.'
                : 'Kept from before.'),
        },
        lens,
        list,
        sel: app.selectedEntry(),
        full: list.length >= MAX_TOPICS,
        own: !!lens && !isBuiltInLens(lens.id),
        meta: hs
          ? hs.loading
            ? 'Picking today’s topics…'
            : hs.error
              ? `Couldn’t pick today’s topics (${hs.error}); showing the last ones`
              : hs.day
                ? `Picked today from ${picker!.from} · pin one to keep it`
                : `${list.length} of ${MAX_TOPICS} · click one to chart it`
          : `${list.length} of ${MAX_TOPICS} · click one to chart it`,
      };
    });
    const chipTitle = (E: Entry) =>
      [E.def.wiki && `Wikipedia: ${E.def.wiki}`, E.def.q && `search: ${E.def.q}`].filter(Boolean).join(' · ');
    function submitTopic() {
      if (addTopic(newTopic.value)) {
        newTopic.value = '';
        nextTick(() => addInput.value?.focus());
      } else addInput.value?.select();
    }
    watch(
      () => ui.focusAdd,
      () => nextTick(() => addInput.value?.focus()),
    );
    return {
      ui,
      view,
      newTopic,
      addInput,
      chipTitle,
      submitTopic,
      select,
      removeTopic,
      removeLens,
      togglePin,
      hotOf,
      isNew,
    };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
/* lenses + watchlist */

.watch-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--hair);
  background: var(--glass-strong);
  border-radius: 999px;
  padding: 2px 2px 2px 10px;
}
.chip.sel {
  border-color: var(--ink);
  box-shadow: 0 0 0 1px var(--ink);
}
.chip .name {
  text-align: left;
  border: 0;
  background: transparent;
  padding: 4px 4px 4px 0;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 999px;
}
.chip .x {
  border: 0;
  background: transparent;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: var(--muted);
  font-size: 15px;
  line-height: 1;
}
.chip .pin {
  border: 0;
  background: transparent;
  width: 24px;
  height: 26px;
  border-radius: 50%;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.chip .pin svg {
  display: block;
}
.chip .pin:hover,
.chip.pinned .pin {
  color: var(--accent);
}
.hot-new {
  font: 600 9.5px/1 var(--mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 999px;
  padding: 2px 5px;
}
/* Where the selected World topic is echoing today */
.hot-why {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--ink-2);
}
.hot-why .echo {
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.03em;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--ink);
  white-space: nowrap;
}
.hot-why .why {
  min-width: 0;
  overflow-wrap: anywhere;
}
.chip .x:hover {
  background: var(--track);
  color: var(--ink);
}
.add-form {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.add-form input {
  border: 1px dashed var(--axis);
  background: var(--card);
  border-radius: 999px;
  padding: 6px 12px;
  width: 220px;
  min-height: 32px;
}
.add-form input:focus,
.lens-add input:focus {
  border-style: solid;
  background: var(--glass-strong);
}
.watch-msg {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--ink-2);
  min-height: 1.2em;
}
.watch-msg.err::before {
  content: '⚠ ';
}
</style>
