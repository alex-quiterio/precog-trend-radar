<template>
  <panel-shell id="p-table" title="All topics · table" :index="index" :data-tick="ui.v">
    <div class="table-scroll">
      <table class="dtable">
        <caption>{{ view.caption }}</caption>
        <thead>
          <tr>
            <th scope="col">Topic</th>
            <th scope="col">Current</th>
            <th scope="col">Change</th>
            <th scope="col">Momentum</th>
            <th scope="col">z-score</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody v-for="g in view.groups" :key="g.l.id">
          <tr class="grp">
            <th colspan="6" scope="colgroup">{{ g.l.name }}</th>
          </tr>
          <tr v-for="E in g.rows" :key="E.key">
            <th scope="row">
              <button class="topic" type="button" @click="select(E.key)">
                <topic-dot :color="E.color"></topic-dot>
                {{ E.name }}
              </button>
            </th>
            <td>
              {{ E.stats ? fmtVal(E.stats.latest) : E.liveError || '—' }}
              <span v-if="E.sparse && view.live" class="muted">(low volume)</span>
            </td>
            <td>{{ E.stats ? fmtPct(E.stats.change) : '—' }}</td>
            <td>
              <template v-if="E.stats">
                {{ arrowOf(E.stats.momentum)[0] }} {{ fmtPct(E.stats.momentum) }}/step
                <span class="sr-only">{{ arrowOf(E.stats.momentum)[1] }}</span>
              </template>
              <template v-else>—</template>
            </td>
            <td>{{ E.stats && E.stats.z != null ? E.stats.z.toFixed(2) : '—' }}</td>
            <td><state-tag :st="E.stats"></state-tag></td>
          </tr>
        </tbody>
      </table>
    </div>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { select } from '../actions';
import { BASE_N, Z_ALERT, Z_WATCH } from '../core/config';
import { ui } from '../core/ui-store';
import { SOURCES } from '../sources/registry';
import { entriesOf, state } from '../state';
import StateTag from './StateTag.vue';
import TopicDot from './TopicDot.vue';
import PanelShell from './PanelShell.vue';

// PRECOG / Trend Radar · Accessible table view across all lenses.

export default defineComponent({
  name: 'TablePanel',
  props: { index: Number },
  components: { PanelShell, StateTag, TopicDot },
  setup() {
    const view = computed(() => {
      ui.v;
      return {
        caption: `Current attention per topic, all lenses (${state.mode === 'demo' ? 'DEMO DATA, simulated; change vs 24 simulated hours ago' : 'LIVE, ' + SOURCES[state.source].label + '; change vs previous day'}). Alert when z > ${Z_ALERT}, watch when z > ${Z_WATCH}, against the previous ${BASE_N} points.`,
        groups: state.lenses.map(l => ({ l, rows: entriesOf(l) })),
        live: state.mode === 'live',
      };
    });
    return { ui, view, select };
  },
});
</script>
