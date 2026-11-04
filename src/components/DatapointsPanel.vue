<template>
  <panel-shell id="p-data" title="Datapoints · PT · NL · EU" :meta="view.meta" :index="index" :data-tick="ui.v">
    <dl class="dp">
      <div v-for="r in view.rows" :key="r.k" class="row">
        <dt>
          {{ r.k }}
          <template v-if="r.sub">
            <br />
            <span class="muted">{{ r.sub }}</span>
          </template>
        </dt>
        <dd>{{ r.v }}</dd>
        <span class="src">
          <a :href="r.href" target="_blank" rel="noopener noreferrer">{{ r.src }}</a>
        </span>
      </div>
    </dl>
    <p v-if="!view.rows.length" class="empty">
      {{ view.loaded ? 'No datapoints could be loaded (offline?).' : 'Loading…' }}
    </p>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { ui } from '../core/ui-store';
import { dp } from '../features/datapoints';
import PanelShell from './PanelShell.vue';

// PRECOG / Trend Radar · Datapoints: official open data for PT, NL and the euro area (always real, even in demo mode).

export default defineComponent({
  name: 'DatapointsPanel',
  props: { index: Number },
  components: { PanelShell },
  setup() {
    const view = computed(() => {
      ui.v;
      return {
        rows: dp.rows.slice(),
        loaded: !!dp.at,
        meta: dp.at
          ? `real data · ${new Date(dp.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
          : 'real data',
      };
    });
    return { ui, view };
  },
});
</script>
