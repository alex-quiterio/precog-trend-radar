<template>
  <panel-shell id="p-markets" title="Prices" :meta="meta" :index="index">
    <ul v-if="notes.length" class="mk-notes">
      <li v-for="(n, i) in notes" :key="i">{{ n }}</li>
    </ul>

    <section v-for="g in groups" :key="g.id" class="mk-group" :aria-label="g.label">
      <h4 class="mk-head">
        {{ g.label }}
        <span>{{ g.hint }}</span>
      </h4>
      <div class="mk-grid">
        <article v-for="t in g.tiles" :key="t.key" class="mk-tile">
          <header>
            <b>{{ t.name }}</b>
            <small>{{ t.what }}</small>
          </header>
          <div class="mk-price">
            {{ t.price }}
            <span class="mk-w" :class="dir(t.w1)">
              {{ pct(t.w1) }}
              <small>wk</small>
            </span>
          </div>
          <sparkline :points="t.spark" :color="color(t.w1)" fit></sparkline>
          <div class="mk-range" :title="`Low and high over ${t.span}`">
            <span>{{ t.low }} – {{ t.high }}</span>
            <span class="mk-span">{{ t.span }}</span>
          </div>
          <div class="mk-moves">
            <span>
              1D
              <i :class="dir(t.d1)">{{ pct(t.d1) }}</i>
            </span>
            <span>
              1M
              <i :class="dir(t.m1)">{{ pct(t.m1) }}</i>
            </span>
            <span class="mk-asof">{{ asOf(t.asOf) }}</span>
          </div>
        </article>
        <template v-if="g.id === 'crypto'">
          <article v-if="global" class="mk-tile mk-stat">
            <header>
              <b>Whole market</b>
              <small>all crypto, CoinGecko</small>
            </header>
            <div class="mk-price">{{ global.cap }}</div>
            <div class="mk-moves">
              <span>
                1D
                <i :class="dir(global.ch24)">{{ pct(global.ch24) }}</i>
              </span>
            </div>
            <div class="mk-dom">
              <span class="mk-bar"><i :style="{ width: global.btc + '%' }"></i></span>
              Bitcoin {{ global.btcText }} · Ether {{ global.ethText }}
            </div>
          </article>
          <article v-if="fng" class="mk-tile mk-stat">
            <header>
              <b>Fear &amp; Greed</b>
              <small>crypto sentiment, 0–100</small>
            </header>
            <div class="mk-price">
              {{ fng.now }}
              <span class="mk-w">{{ fng.label }}</span>
            </div>
            <sparkline :points="fng.series" color="var(--accent-2)" fit></sparkline>
            <div class="mk-range">
              <span>30 days</span>
              <span>a week ago {{ fng.weekAgo }}</span>
            </div>
          </article>
        </template>
      </div>
    </section>

    <ul v-if="!groups.length && st.loading" class="mk-wait" aria-label="Loading prices">
      <li v-for="n in 4" :key="n"></li>
    </ul>
    <p v-else-if="!groups.length" class="mk-empty">No prices could be read just now.</p>
    <p v-if="st.errors.length" class="mk-err">Not loaded: {{ st.errors.join(' · ') }}</p>
    <p class="mk-foot">
      Real prices in US dollars unless noted. US shares and indices are priced through tokenized shares (xStocks), which
      trade around the clock and track the listed price; oil is EIA's daily spot price, a few days behind. Facts, not
      advice.
    </p>
  </panel-shell>
</template>

<script lang="ts">
import { useApp } from '@/context';
import { computed, defineComponent, onBeforeUnmount, onMounted } from 'vue';
import { MIN } from '@core/config';
import { ago } from '@core/format';
import { boardOf, createMarkets, pct, takeaways } from '@features/markets';
import PanelShell from '@components/PanelShell.vue';
import Sparkline from '@components/Sparkline.vue';

// PRECOG / Trend Radar · Markets' price board: takeaways in plain sentences, then a tile per instrument with
// its real price over the last one or two weeks. Loads while the Markets channel is on screen.

export default defineComponent({
  name: 'MarketsPanel',
  components: { PanelShell, Sparkline },
  props: { index: { type: Number, default: 0 } },
  setup() {
    const { app } = useApp();
    const ui = app.ui;
    const markets = createMarkets();
    const st = markets.state;
    let timer: ReturnType<typeof setInterval> | undefined;
    onMounted(() => {
      void markets.load();
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') void markets.load();
      }, 10 * MIN);
    });
    onBeforeUnmount(() => {
      clearInterval(timer);
      markets.stop();
    });
    const groups = computed(() => (st.data ? boardOf(st.data) : []));
    const notes = computed(() => (st.data ? takeaways(st.data) : []));
    const global = computed(() => {
      const g = st.data?.global;
      if (!g) return null;
      return {
        cap: g.cap >= 1e12 ? `$${(g.cap / 1e12).toFixed(2)}T` : `$${(g.cap / 1e9).toFixed(0)}B`,
        ch24: g.ch24,
        btc: g.btc ?? 0,
        btcText: g.btc == null ? '–' : `${g.btc.toFixed(1)}%`,
        ethText: g.eth == null ? '–' : `${g.eth.toFixed(1)}%`,
      };
    });
    const fng = computed(() => {
      const f = st.data?.fng;
      const s = f?.series ?? [];
      const last = s[s.length - 1];
      if (!f || !last) return null;
      const week = [...s].reverse().find(p => p.t <= last.t - 7 * 864e5 + 36e5);
      return { now: last.value, label: f.label, series: s, weekAgo: week?.value ?? '–' };
    });
    const dir = (p: number | null) => (p == null ? '' : p >= 0.05 ? 'up' : p <= -0.05 ? 'down' : '');
    const color = (p: number | null) => ((p ?? 0) >= 0 ? 'var(--accent)' : 'var(--ink-2)');
    const asOf = (t: number) =>
      t ? (ui.now - t < 2 * 864e5 ? ago(t, ui.now) : new Date(t).toISOString().slice(0, 10)) : '';
    const meta = computed(() => (st.at ? `checked ${ago(st.at, ui.now)}` : st.loading ? 'reading…' : ''));
    return { st, groups, notes, global, fng, pct, dir, color, asOf, meta };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
.mk-notes {
  margin: 0 0 16px;
  padding: 12px 14px 12px 30px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: var(--accent-soft);
  font-size: 13.5px;
  line-height: 1.5;
}
.mk-notes li + li {
  margin-top: 6px;
}
.mk-notes li::marker {
  color: var(--accent);
}
.mk-group + .mk-group {
  margin-top: 16px;
}
.mk-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 8px;
  color: var(--accent);
  font: 600 10.5px var(--mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.mk-head span {
  color: var(--muted);
  font: 400 11px var(--sans);
  letter-spacing: 0;
  text-transform: none;
}
.mk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}
.mk-tile {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--hair);
  border-radius: 12px;
  background: var(--card);
}
.mk-tile header {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.mk-tile header b {
  font-size: 12.5px;
}
.mk-tile header small {
  overflow: hidden;
  color: var(--muted);
  font-size: 10.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mk-price {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin: 6px 0 2px;
  font: 600 18px var(--mono);
  letter-spacing: -0.02em;
}
.mk-w {
  font: 600 12px var(--mono);
  white-space: nowrap;
}
.mk-w small {
  color: var(--muted);
  font: 400 10px var(--sans);
}
.mk-tile svg {
  display: block;
  width: 100%;
  height: 40px;
}
.mk-range,
.mk-moves {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  color: var(--muted);
  font: 400 10.5px var(--mono);
}
.mk-moves {
  margin-top: 4px;
}
.mk-moves i {
  font-style: normal;
  color: var(--ink-2);
}
.up {
  color: var(--accent);
}
.mk-moves i.up {
  color: var(--accent);
}
.mk-moves i.down,
.mk-w.down {
  color: var(--ink-2);
}
.mk-asof {
  margin-left: auto;
}
.mk-dom {
  margin-top: 10px;
  color: var(--muted);
  font-size: 11px;
}
.mk-bar {
  display: block;
  height: 6px;
  margin-bottom: 6px;
  border-radius: 3px;
  background: var(--track);
  overflow: hidden;
}
.mk-bar i {
  display: block;
  height: 100%;
  background: var(--accent);
}
.mk-wait {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.mk-wait li {
  height: 130px;
  border-radius: 12px;
  background: var(--track);
  animation: dg-pulse 1.6s ease-in-out infinite;
}
.mk-empty,
.mk-err {
  color: var(--muted);
  font-size: 12px;
}
.mk-foot {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
@media (max-width: 560px) {
  .mk-grid,
  .mk-wait {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .mk-tile {
    padding: 9px 10px;
  }
  .mk-price {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    font-size: 16px;
  }
  /* Every tile in a group shares its period and its time, so a narrow tile drops them. */
  .mk-span,
  .mk-asof {
    display: none;
  }
}
</style>
