<template>
  <panel-shell id="p-watch" title="Topics" :meta="view.meta" :index="index" :data-tick="ui.v">
    <template #controls>
      <button
        v-if="view.own"
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
import { ref, computed, watch, nextTick, defineComponent } from 'vue';
import { addTopic, removeLens, removeTopic, select } from '../actions';
import { CHANNELS } from '../channels';
import { MAX_TOPICS } from '../core/config';
import { ui } from '../core/ui-store';
import { activeLens, entriesOf, selectedEntry } from '../state';
import TopicDot from './TopicDot.vue';
import PanelShell from './PanelShell.vue';

// PRECOG / Trend Radar · Topics of the channel on screen: pick one to chart, add or remove topics.

export default defineComponent({
  name: 'LensPanel',
  props: { index: Number },
  components: { PanelShell, TopicDot },
  setup() {
    const newTopic = ref(''),
      addInput = ref(null);
    const view = computed(() => {
      ui.v;
      const lens = activeLens(),
        list = entriesOf(lens);
      return {
        lens,
        list,
        sel: selectedEntry(),
        full: list.length >= MAX_TOPICS,
        own: !!lens && !CHANNELS.some(c => c.lensId === lens.id),
        meta: `${list.length} of ${MAX_TOPICS} · click one to chart it`,
      };
    });
    const chipTitle = E =>
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
