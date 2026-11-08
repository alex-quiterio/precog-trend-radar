<template>
  <panel-shell id="p-gdp" title="The largest economies" :meta="meta" :index="index">
    <ol v-if="rows.length" class="gdp-list" :aria-label="`GDP in ${year}, current US dollars`">
      <li v-for="e in rows" :key="e.iso" class="gdp-row" :title="e.tip">
        <span class="gdp-name">{{ e.name }}</span>
        <span class="gdp-val">{{ e.text }}</span>
        <span class="gdp-bar" aria-hidden="true"><i :style="{ width: e.bar + '%' }"></i></span>
        <span class="gdp-ch">{{ e.change }}</span>
      </li>
    </ol>
    <ul v-else-if="st.loading" class="gdp-wait" aria-label="Loading GDP">
      <li v-for="n in 7" :key="n"></li>
    </ul>
    <p v-else class="gdp-foot">{{ st.error ? `Not loaded: ${st.error}` : 'No GDP figures could be read just now.' }}</p>
    <p v-if="rows.length" class="gdp-foot">
      GDP in {{ year }}, current US dollars (World Bank). Nominal: it moves with exchange rates as well as output. The
      change is against five years before, in dollars.
    </p>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted } from 'vue';
import { createGdp, topEconomies, usd } from '@features/gdp';
import PanelShell from '@components/PanelShell.vue';

// PRECOG / Trend Radar · Markets' largest economies: the top seven by GDP as bars, with their five-year change.

export default defineComponent({
  name: 'GdpPanel',
  components: { PanelShell },
  props: { index: { type: Number, default: 0 } },
  setup() {
    const gdp = createGdp();
    const st = gdp.state;
    onMounted(() => void gdp.load());
    const top = computed(() => (st.data ? topEconomies(st.data) : []));
    const year = computed(() => top.value[0]?.year ?? '');
    const rows = computed(() => {
      const max = top.value[0]?.value || 1;
      return top.value.map(e => {
        const change =
          e.change5 == null ? '' : `${e.change5 >= 0 ? '+' : '−'}${Math.abs(Math.round(e.change5))}% in 5 yrs`;
        return {
          ...e,
          text: usd(e.value),
          bar: (e.value / max) * 100,
          change,
          tip: `${e.name}: ${usd(e.value)} in ${e.year}${change ? ` (${change.replace('yrs', 'years')})` : ''}`,
        };
      });
    });
    const meta = computed(() => (year.value ? `World Bank · ${year.value}` : ''));
    return { st, rows, year, meta };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
.gdp-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.gdp-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  align-items: baseline;
}
.gdp-name {
  font-size: 13.5px;
}
.gdp-val {
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  font-weight: 600;
}
.gdp-bar {
  height: 10px;
  border-radius: 0 4px 4px 0;
  background: var(--track);
  overflow: hidden;
}
.gdp-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.6s ease;
}
.gdp-ch {
  color: var(--muted);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.gdp-row:hover .gdp-bar i {
  filter: brightness(1.15);
}
.gdp-wait {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.gdp-wait li {
  height: 30px;
  border-radius: 8px;
  background: var(--track);
  animation: dg-pulse 1.6s ease-in-out infinite;
}
.gdp-foot {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
</style>
