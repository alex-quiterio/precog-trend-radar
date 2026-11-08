<template>
  <panel-shell id="p-gdp" title="The largest economies" :meta="meta" :index="index">
    <div v-if="rows.length" class="gdp-cols" aria-hidden="true">
      <span></span>
      <span>GDP</span>
      <span>Happiness</span>
    </div>
    <template v-for="sec in sections" :key="sec.id">
      <section v-if="sec.rows.length" :class="['gdp-sec', sec.id]" :aria-label="sec.aria">
        <h4 v-if="sec.label" class="gdp-head">
          {{ sec.label }}
          <span>{{ sec.hint }}</span>
        </h4>
        <ol class="gdp-list">
          <li v-for="e in sec.rows" :key="e.iso" class="gdp-row" :title="e.tip">
            <span class="gdp-name">{{ e.name }}</span>
            <span class="gdp-val">{{ e.text }}</span>
            <span class="gdp-happy">{{ e.happy }}</span>
            <span class="gdp-bar" aria-hidden="true"><i :style="{ width: e.bar + '%' }"></i></span>
            <span class="gdp-ch">{{ e.change }}</span>
            <span class="gdp-rank">
              <span v-if="e.score != null" class="gdp-meter" aria-hidden="true">
                <i :style="{ width: e.score * 10 + '%' }"></i>
              </span>
              <span class="gdp-rank-n">{{ e.rank }}</span>
            </span>
          </li>
        </ol>
      </section>
    </template>
    <ul v-if="!rows.length && st.loading" class="gdp-wait" aria-label="Loading GDP">
      <li v-for="n in 7" :key="n"></li>
    </ul>
    <p v-else-if="!rows.length" class="gdp-foot">
      {{ st.error ? `Not loaded: ${st.error}` : 'No GDP figures could be read just now.' }}
    </p>
    <p v-if="rows.length" class="gdp-foot">{{ foot }}</p>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted } from 'vue';
import { type Row, createGdp, happiestEconomies, homeEconomies, topEconomies, usd } from '@features/gdp';
import PanelShell from '@components/PanelShell.vue';

// PRECOG / Trend Radar · Markets' largest economies: the top seven by GDP as bars, with their five-year change,
// then the Netherlands and Portugal, then the three happiest countries, all on the same scale. Beside each, its
// World Happiness Report score with a 0–10 meter and its world rank.

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
    // Every bar is measured against the largest economy, so the two lists share one scale.
    const row = (e: Row) => {
      const max = top.value[0]?.value || 1;
      const change =
        e.change5 == null ? '' : `${e.change5 >= 0 ? '+' : '−'}${Math.abs(Math.round(e.change5))}% in 5 yrs`;
      const h = st.happy?.[e.iso];
      const gdpTip =
        e.value != null ? `${usd(e.value)} in ${e.year}${change ? ` (${change.replace('yrs', 'years')})` : ''}` : '';
      return {
        ...e,
        happy: h ? h.score.toFixed(2) : st.happy ? '–' : '',
        score: h?.score ?? null,
        rank: h ? `#${h.rank}` : '',
        text: e.value != null ? usd(e.value) : '–',
        bar: e.value != null ? (e.value / max) * 100 : 0,
        change,
        tip: [`${e.name}: ${gdpTip}`, h ? `happiness ${h.score.toFixed(2)} of 10, #${h.rank} of ${h.of}` : '']
          .filter(Boolean)
          .join(' · '),
      };
    };
    const rows = computed(() => top.value.map(row));
    const home = computed(() => (st.data ? homeEconomies(st.data).map(row) : []));
    const happiest = computed(() => (st.data && st.happy ? happiestEconomies(st.data, st.happy).map(row) : []));
    const sections = computed(() => [
      { id: 'top', label: '', hint: '', aria: `GDP in ${year.value}, current US dollars`, rows: rows.value },
      { id: 'home', label: 'Closer to home', hint: 'same scale as above', aria: 'Closer to home', rows: home.value },
      {
        id: 'happy',
        label: 'Happiest',
        hint: 'the top 3 in the world',
        aria: 'The happiest countries',
        rows: happiest.value,
      },
    ]);
    const meta = computed(() => (year.value ? `World Bank · ${year.value}` : ''));
    const anyHappy = computed(() => Object.values(st.happy ?? {})[0]);
    const happyYear = computed(() => anyHappy.value?.year ?? 0);
    const happyOf = computed(() => anyHappy.value?.of ?? 0);
    const foot = computed(
      () =>
        `GDP in ${year.value}, current US dollars (World Bank). Nominal: it moves with exchange rates as well as ` +
        'output. The change is against five years before, in dollars. Happiness is the World Happiness Report’s life ' +
        `evaluation, 0 to 10, and the country’s rank among the ${happyOf.value || ''} countries it scores` +
        (happyYear.value ? ` (surveys ${happyYear.value - 2}–${happyYear.value}, via Our World in Data).` : '.'),
    );
    return { st, rows, sections, year, meta, foot };
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
.gdp-cols,
.gdp-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 76px;
  gap: 4px 12px;
  align-items: baseline;
}
.gdp-cols {
  margin: 0 0 6px;
  color: var(--muted);
  font: 600 10px var(--mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.gdp-cols span:not(:first-child) {
  text-align: right;
}
.gdp-happy {
  font-variant-numeric: tabular-nums;
  font-size: 16px;
  font-weight: 700;
  text-align: right;
}
.gdp-rank {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  color: var(--ink-2);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}
/* Happiness out of 10: a short meter of its own, in its own column, apart from the GDP bar. */
.gdp-rank-n {
  min-width: 32px;
  text-align: right;
}
.gdp-meter {
  flex: none;
  width: 28px;
  height: 4px;
  border-radius: 99px;
  background: var(--track);
  overflow: hidden;
}
.gdp-meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ink-2);
}
.gdp-val {
  text-align: right;
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
.gdp-sec + .gdp-sec {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--glass-border);
}
.gdp-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 8px;
  color: var(--accent);
  font: 600 10.5px var(--mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.gdp-head span {
  color: var(--muted);
  font: 400 11px var(--sans);
  letter-spacing: 0;
  text-transform: none;
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
