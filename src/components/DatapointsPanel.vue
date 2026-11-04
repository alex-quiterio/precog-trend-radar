<template>
  <panel-shell id="p-data" title="Open data" :meta="view.meta" :index="index" :data-tick="ui.v">
    <div v-if="view.groups.length" class="dp-groups">
      <section v-for="g in view.groups" :key="g.id" class="dp-group" :aria-labelledby="'dp-' + g.id">
        <header>
          <h4 :id="'dp-' + g.id">{{ g.label }}</h4>
          <span class="muted">{{ g.hint }}</span>
        </header>
        <dl class="dp">
          <div v-for="r in g.rows" :key="r.k" class="row">
            <dt>
              {{ r.k }}
              <span v-if="r.sub" class="sub">{{ r.sub }}</span>
            </dt>
            <dd>{{ r.v }}</dd>
            <sparkline
              v-if="r.spark && r.spark.length > 1"
              class="dp-spark"
              :points="r.spark"
              color="currentColor"
              fit
            />
            <span class="src">
              <a :href="r.href" target="_blank" rel="noopener noreferrer">{{ r.src }}</a>
            </span>
          </div>
        </dl>
      </section>
    </div>
    <p v-else class="empty">{{ view.loaded ? 'No datapoints could be loaded (offline?).' : 'Loading…' }}</p>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { activeChannel, channelDatapoints } from '../channels';
import { ui } from '../core/ui-store';
import { DATAPOINT_GROUPS, dp } from '../features/datapoints';
import PanelShell from './PanelShell.vue';
import Sparkline from './Sparkline.vue';

// PRECOG / Trend Radar · Context: the open-data cards the channel on screen picks, updated hourly.

export default defineComponent({
  name: 'DatapointsPanel',
  props: { index: Number },
  components: { PanelShell, Sparkline },
  setup() {
    const view = computed(() => {
      ui.v;
      // The channel picks its cards and their order; they're shown under their group headings.
      const ids = channelDatapoints(activeChannel());
      const rows = ids.map(id => dp.rows.find(r => r.id === id)).filter(Boolean);
      const order = [...new Set(rows.map(r => r.group))];
      return {
        groups: order.map(id => ({
          ...DATAPOINT_GROUPS.find(g => g.id === id),
          rows: rows.filter(r => r.group === id),
        })),
        loaded: !!dp.at,
        meta: dp.at
          ? `open data · ${new Date(dp.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
          : 'open data',
      };
    });
    return { ui, view };
  },
});
</script>
