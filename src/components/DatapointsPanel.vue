<template>
  <panel-shell id="p-data" title="Open data" :meta="view.meta" :index="index">
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
import { useApp } from '@/context';
import { computed, defineComponent } from 'vue';
import { activeChannel, channelDatapoints } from '@/channels';
import { DATAPOINT_GROUPS, type DatapointRow } from '@features/datapoints';
import PanelShell from '@components/PanelShell.vue';
import Sparkline from '@components/Sparkline.vue';

// PRECOG / Trend Radar · Context: the open-data cards the channel on screen picks, updated hourly.

export default defineComponent({
  name: 'DatapointsPanel',
  props: { index: Number },
  components: { PanelShell, Sparkline },
  setup() {
    const { app, datapoints } = useApp();
    const ui = app.ui;
    const dp = datapoints.state;
    const view = computed(() => {
      // The channel picks its cards and their order; they're shown under their group headings.
      const ids = channelDatapoints(activeChannel(app));
      const rows = ids.map(id => dp.rows.find(r => r.id === id)).filter((r): r is DatapointRow => !!r);
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

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
/* datapoints */
.dp {
  margin: 0;
  display: flex;
  flex-direction: column;
}
.dp .row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--hair);
}
.dp .row:last-child {
  border-bottom: 0;
}
.dp dt {
  font-size: 12px;
  color: var(--ink-2);
}
.dp dd {
  margin: 0;
  text-align: right;
  font: 500 18px/1.1 var(--sans);
  white-space: nowrap;
}
.dp .dp-spark {
  grid-column: 1 / -1;
  width: 100%;
  height: 34px;
  color: var(--ink-2);
}
.dp .src {
  grid-column: 1 / -1;
  font-size: 10.5px;
  color: var(--muted);
}
.dp .src a {
  color: var(--muted);
}

.dp dt .sub {
  display: block;
  color: var(--muted);
  font-size: 11px;
}
.dp-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 6px 22px;
}
.dp-group > header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 0 4px;
  border-bottom: 1px solid var(--axis);
}
.dp-group h4 {
  margin: 0;
  font: 600 15px/1.2 var(--sans);
  color: var(--ink);
}
.dp-group header .muted {
  font-size: 10.5px;
}
/* Phones */
@media (max-width: 600px) {
  .dp dd {
    white-space: normal;
    font-size: 16px;
  }
}
</style>
