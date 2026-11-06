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
      <span v-for="E in view.list" :key="E.key" class="chip" :class="{ sel: view.sel === E }">
        <button class="name" type="button" :aria-pressed="view.sel === E" :title="chipTitle(E)" @click="select(E.key)">
          <topic-dot :color="E.color"></topic-dot>
          {{ E.name }}
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
    <p class="watch-msg" :class="{ err: ui.watchErr }" role="status">{{ ui.watchMsg }}</p>
  </panel-shell>
</template>

<script lang="ts">
import { useApp } from '@/context';
import { ref, computed, watch, nextTick, defineComponent } from 'vue';
import { isBuiltInLens } from '@/channels';
import { MAX_TOPICS } from '@core/config';
import type { Entry } from '@/types';
import TopicDot from '@components/TopicDot.vue';
import PanelShell from '@components/PanelShell.vue';

// PRECOG / Trend Radar · Topics of the channel on screen: pick one to chart, add or remove topics.

export default defineComponent({
  name: 'LensPanel',
  props: { index: Number },
  components: { PanelShell, TopicDot },
  setup() {
    const { app, actions } = useApp();
    const ui = app.ui;
    const { addTopic, removeLens, removeTopic, select } = actions;
    const newTopic = ref(''),
      addInput = ref<HTMLInputElement | null>(null);
    const view = computed(() => {
      const lens = app.activeLens(),
        list = app.entriesOf(lens);
      return {
        lens,
        list,
        sel: app.selectedEntry(),
        full: list.length >= MAX_TOPICS,
        own: !!lens && !isBuiltInLens(lens.id),
        meta: `${list.length} of ${MAX_TOPICS} · click one to chart it`,
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
