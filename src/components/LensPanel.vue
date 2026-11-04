<template>
  <panel-shell id="p-watch" title="Lenses & watchlist" :meta="view.meta" :index="index" :data-tick="ui.v">
    <div class="lens-tabs" role="tablist" aria-label="Lenses">
      <span v-for="t in view.tabs" :key="t.l.id" class="lens-tab" role="tab" :aria-selected="t.active">
        <button type="button" class="lens-name" @click="selectLens(t.l.id)">{{ t.l.name }}</button>
        <span v-if="t.heat" :class="['heat', t.heat.level]" :aria-label="t.heat.n + ' ' + t.heat.level">
          {{ t.heat.level === 'alert' ? '▲' : '◆' }}{{ t.heat.n }}
        </span>
        <button
          v-if="t.active && view.tabs.length > 1"
          class="lx"
          type="button"
          :aria-label="'Remove lens ' + t.l.name"
          @click="removeLens(t.l.id)"
        >
          ×
        </button>
      </span>
      <form v-if="view.tabs.length < MAX_LENSES" class="lens-add" autocomplete="off" @submit.prevent="submitLens">
        <label class="sr-only" for="lens-input">New lens</label>
        <input id="lens-input" v-model="newLens" placeholder="+ new lens" maxlength="30" />
      </form>
    </div>
    <p class="lens-desc">{{ view.lens ? view.lens.desc || 'Your lens. Add up to six topics.' : '' }}</p>
    <div class="watch-row">
      <span v-for="E in view.list" :key="E.key" class="chip" :class="{ sel: view.sel === E }">
        <button class="name" type="button" :aria-pressed="view.sel === E" :title="chipTitle(E)" @click="select(E.key)">
          <topic-dot :color="E.color"></topic-dot>
          {{ E.name }}
        </button>
        <button class="x" type="button" :aria-label="'Remove ' + E.name" @click="removeTopic(E.key)">×</button>
      </span>
      <form class="add-form" autocomplete="off" @submit.prevent="submitTopic">
        <label class="sr-only" for="add-input">Add a topic to {{ view.lens ? view.lens.name : '' }}</label>
        <input
          id="add-input"
          ref="addInput"
          v-model="newTopic"
          type="text"
          maxlength="120"
          :disabled="view.full"
          :placeholder="view.full ? 'Lens full (6/6)' : '+ topic  (or: Name | wiki: Title | q: query)'"
        />
        <button class="btn" type="submit" :disabled="view.full">Track</button>
      </form>
    </div>
    <p class="watch-msg" :class="{ err: ui.watchErr }" role="status">{{ ui.watchMsg }}</p>
  </panel-shell>
</template>

<script lang="ts">
import { ref, computed, watch, nextTick, defineComponent } from 'vue';
import { addLens, addTopic, lensHeat, removeLens, removeTopic, select, selectLens } from '../actions';
import { MAX_LENSES, MAX_TOPICS } from '../core/config';
import { ui } from '../core/ui-store';
import { activeLens, allEntries, entriesOf, selectedEntry, state } from '../state';
import TopicDot from './TopicDot.vue';
import PanelShell from './PanelShell.vue';

// PRECOG / Trend Radar · Lenses & watchlist: lens tabs, topic chips, add topic, add/remove lens.

export default defineComponent({
  name: 'LensPanel',
  props: { index: Number },
  components: { PanelShell, TopicDot },
  setup() {
    const newTopic = ref(''),
      newLens = ref(''),
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
        tabs: state.lenses.map(l => ({ l, active: l === lens, heat: lensHeat(l) })),
        meta: `${list.length}/${MAX_TOPICS} in ${lens ? lens.name : '—'} · ${allEntries().length} total`,
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
    function submitLens() {
      addLens(newLens.value);
      newLens.value = '';
    }
    watch(
      () => ui.focusAdd,
      () => nextTick(() => addInput.value?.focus()),
    );
    return {
      ui,
      view,
      newTopic,
      newLens,
      addInput,
      chipTitle,
      submitTopic,
      submitLens,
      select,
      selectLens,
      removeTopic,
      removeLens,
      MAX_LENSES,
      MAX_TOPICS,
    };
  },
});
</script>
