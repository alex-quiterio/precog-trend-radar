<template>
  <panel-shell id="p-multiples" :title="view.title" meta="click a card to focus" :index="index" :data-tick="ui.v">
    <div class="multiples">
      <button
        v-for="c in view.cards"
        :key="c.E.key"
        class="card"
        :class="{ sel: c.sel }"
        type="button"
        :aria-pressed="c.sel"
        :aria-label="label(c.E)"
        @click="select(c.E.key)"
      >
        <span class="cname">
          <topic-dot :color="c.E.color"></topic-dot>
          <span>{{ c.E.name }}</span>
        </span>
        <sparkline :points="c.points" :color="c.E.color" :note="c.E.liveError"></sparkline>
        <span class="crow">
          <span class="cval">{{ c.E.stats ? fmtVal(c.E.stats.latest) : '—' }}</span>
          <span class="cmom" v-if="c.E.stats">
            {{ arrowOf(c.E.stats.momentum)[0] }} {{ fmtPct(c.E.stats.momentum) }}/step
          </span>
        </span>
        <span><state-tag :st="c.E.stats"></state-tag></span>
      </button>
      <p v-if="!view.cards.length" class="empty">No topics in this lens yet.</p>
    </div>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { select } from '../actions';
import { fmtVal } from '../core/format';
import { arrowOf } from '../core/stats';
import { ui } from '../core/ui-store';
import { activeLens, entriesOf, selectedEntry, series } from '../state';
import StateTag from './StateTag.vue';
import TopicDot from './TopicDot.vue';
import PanelShell from './PanelShell.vue';
import Sparkline from './Sparkline.vue';

// PRECOG / Trend Radar · Small-multiple cards (sparkline, value, momentum) for the active lens.

export default defineComponent({
  name: 'CardsPanel',
  props: { index: Number },
  components: { PanelShell, StateTag, TopicDot, Sparkline },
  setup() {
    const view = computed(() => {
      ui.v;
      const lens = activeLens(),
        sel = selectedEntry();
      return {
        title: lens ? lens.name : 'This lens',
        cards: entriesOf(lens).map(E => ({ E, sel: E === sel, points: series(E).slice() })),
      };
    });
    const label = E =>
      `${E.name}: ${E.stats ? fmtVal(E.stats.latest) + ', ' + arrowOf(E.stats.momentum)[1] : 'no data'}`;
    return { ui, view, label, select };
  },
});
</script>
