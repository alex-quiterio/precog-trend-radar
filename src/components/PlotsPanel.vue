<template>
  <panel-shell id="p-plots" title="Plots, side by side" :meta="meta" :index="index">
    <p v-if="!st.plots.length" class="pl-intro">
      Add the land you’re looking at, up to {{ max }} plots, to compare its rain, heat, frost, soil and fire risk.
    </p>

    <div v-if="st.plots.length" class="pl-scroll">
      <table class="pl-table">
        <caption class="pl-cap">Each plot over the last 12 months, against its 1991–2020 normal</caption>
        <thead>
          <tr>
            <th v-for="p in st.plots" :key="p.id" scope="col">
              <input
                v-if="editing === p.id"
                :ref="setEditEl"
                v-model="draft"
                class="pl-in pl-rename"
                type="text"
                maxlength="24"
                :aria-label="`New name for ${p.name}`"
                @keydown.enter.prevent="saveName"
                @keydown.escape.prevent="editing = ''"
                @blur="saveName"
              />
              <button
                v-else
                type="button"
                class="pl-name"
                :aria-label="`Rename plot ${p.name}`"
                title="Rename"
                @click="startRename(p)"
              >
                {{ p.name }}
              </button>
              <button
                type="button"
                class="pl-x"
                :aria-label="`Remove plot ${p.name}`"
                :title="`Remove ${p.name}`"
                @click="plots.remove(p.id)"
              >
                ×
              </button>
              <a class="pl-coords" :href="mapUrl(p)" target="_blank" rel="noopener noreferrer">
                {{ p.lat.toFixed(3) }}, {{ p.lon.toFixed(3) }}
              </a>
            </th>
          </tr>
        </thead>
        <tbody v-for="m in metrics" :key="m.key">
          <tr class="pl-label">
            <th :colspan="st.plots.length" scope="colgroup">
              {{ m.label }}
              <small v-if="m.hint">{{ m.hint }}</small>
            </th>
          </tr>
          <tr>
            <td v-for="p in st.plots" :key="p.id" :class="cell(p.id, m.key).cls">
              <b>{{ cell(p.id, m.key).v }}</b>
              <small v-if="cell(p.id, m.key).sub">{{ cell(p.id, m.key).sub }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <form v-if="st.plots.length < max" class="pl-add" @submit.prevent="addTyped">
      <input
        v-model="name"
        class="pl-in pl-in-name"
        type="text"
        maxlength="24"
        placeholder="Name"
        aria-label="Plot name"
      />
      <input
        v-model="where"
        class="pl-in pl-in-where"
        type="text"
        inputmode="text"
        placeholder="39.61, -7.99 or a Google Maps link"
        aria-label="Plot location: coordinates or a Google Maps link"
      />
      <button type="submit" class="pl-btn">Add plot</button>
      <button v-if="canLocate" type="button" class="pl-btn pl-ghost" :disabled="locating" @click="addHere">
        {{ locating ? 'Locating…' : 'Use where I am' }}
      </button>
    </form>
    <p v-if="msg" class="pl-msg" role="status">{{ msg }}</p>

    <p class="pl-foot">
      From Open-Meteo’s reanalysis (ERA5, a 10–25 km grid): it tells regions apart, not a valley from the ridge above
      it. Dry months are those under half their normal rain, among months that usually get 15 mm or more. Fire risk is
      IPMA’s for the nearest municipality, in Portugal only; its “today” is computed the day before, so after rain look
      at tomorrow’s. Plots stay in this browser.
    </p>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onMounted, ref } from 'vue';
import { ago, nf0, nf2 } from '@core/format';
import { useApp } from '@/context';
import { FIRE_WORDS, MAX_PLOTS, type Plot, createPlots, dryMonths } from '@features/plots';
import PanelShell from '@components/PanelShell.vue';

// PRECOG / Trend Radar · Watch a plot: up to four plots of land, compared measure by measure. Each measure is a
// label row with the plots' values under it, so the table stays narrow enough for a phone.

type Cell = { v: string; sub?: string; cls?: string };

export default defineComponent({
  name: 'PlotsPanel',
  components: { PanelShell },
  props: { index: { type: Number, default: 0 } },
  setup() {
    const { app } = useApp();
    const plots = createPlots();
    const st = plots.state;
    onMounted(() => void plots.load());
    const name = ref(''),
      where = ref(''),
      msg = ref(''),
      locating = ref(false);
    const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;
    function addTyped() {
      msg.value = plots.add(name.value, where.value);
      if (!msg.value) name.value = where.value = '';
    }
    function addHere() {
      locating.value = true;
      msg.value = '';
      navigator.geolocation.getCurrentPosition(
        pos => {
          locating.value = false;
          msg.value = plots.add(name.value || 'Here', { lat: pos.coords.latitude, lon: pos.coords.longitude });
          if (!msg.value) name.value = '';
        },
        () => {
          locating.value = false;
          msg.value = 'Your location isn’t available: paste coordinates instead.';
        },
        { enableHighAccuracy: true, timeout: 15000 },
      );
    }
    const metrics = [
      { key: 'rain', label: 'Rain, last 12 months', hint: 'and against normal' },
      { key: 'dry', label: 'Dry months', hint: 'of the last 12' },
      { key: 'hot', label: 'Days over 35 °C', hint: 'last 12 months' },
      { key: 'frost', label: 'Frost nights', hint: 'below 0 °C' },
      { key: 'soil', label: 'Soil moisture now', hint: '3–9 cm down' },
      { key: 'fire', label: 'Fire risk today', hint: 'IPMA' },
      { key: 'elev', label: 'Elevation', hint: '' },
    ];
    const cells = computed(() => {
      const out: Record<string, Record<string, Cell>> = {};
      st.plots.forEach(p => {
        const r = st.reads[p.id];
        const wait: Cell = { v: r?.error ? '–' : '…', sub: r?.error ? 'not loaded' : '' };
        const y = r?.year,
          n = r?.normals;
        const annual = n ? n.reduce((a, b) => a + b, 0) : 0;
        const pct = y && annual ? Math.round((y.rainMm / annual) * 100) : null;
        out[p.id] = {
          rain: y
            ? {
                v: `${nf0.format(y.rainMm)} mm`,
                sub: pct != null ? `${pct}% of normal${pct < 75 ? ', dry' : ''}` : '',
                cls: pct != null && pct < 75 ? 'pl-low' : '',
              }
            : wait,
          dry:
            y && n
              ? dryMonths(y, n) >= 3
                ? { v: nf0.format(dryMonths(y, n)), sub: 'a dry stretch', cls: 'pl-low' }
                : { v: nf0.format(dryMonths(y, n)) }
              : wait,
          hot: y ? { v: nf0.format(y.hotDays) } : wait,
          frost: y ? { v: nf0.format(y.frostNights) } : wait,
          soil: r?.soil
            ? {
                v: `${nf2.format(r.soil.now)} m³/m³`,
                sub: `${r.soil.change >= 0 ? '+' : '−'}${nf0.format(Math.abs(r.soil.change))}% in 30 days`,
              }
            : r
              ? { v: '–' }
              : wait,
          fire:
            r && ('fire' in r || 'fireTomorrow' in r)
              ? r.fire != null
                ? {
                    v: FIRE_WORDS[r.fire],
                    sub:
                      r.fireTomorrow != null && r.fireTomorrow !== r.fire
                        ? `level ${r.fire} of 5 · tomorrow ${FIRE_WORDS[r.fireTomorrow]}`
                        : `level ${r.fire} of 5`,
                    cls: r.fire >= 4 ? 'pl-low' : '',
                  }
                : {
                    v: '–',
                    sub: r.fireTomorrow == null ? 'outside Portugal' : `tomorrow ${FIRE_WORDS[r.fireTomorrow]}`,
                  }
              : r
                ? { v: '–' }
                : wait,
          elev: r?.elevation != null ? { v: `${nf0.format(r.elevation)} m` } : r ? { v: '–' } : wait,
        };
      });
      return out;
    });
    const cell = (id: string, key: string): Cell => cells.value[id]?.[key] ?? { v: '…' };
    // Renaming in place: the name turns into a field; Enter or leaving it saves, Escape keeps the old name.
    const editing = ref(''),
      draft = ref('');
    let editEl: HTMLInputElement | null = null;
    const setEditEl = (el: unknown) => void (editEl = el instanceof HTMLInputElement ? el : null);
    function startRename(p: Plot) {
      editing.value = p.id;
      draft.value = p.name;
      void nextTick(() => editEl?.select());
    }
    function saveName() {
      if (!editing.value) return;
      plots.rename(editing.value, draft.value);
      editing.value = '';
    }
    const mapUrl = (p: Plot) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
    const meta = computed(() =>
      st.at && st.plots.length ? `checked ${ago(st.at, app.ui.now)}` : st.loading ? 'reading…' : '',
    );
    return {
      st,
      plots,
      metrics,
      cell,
      mapUrl,
      meta,
      name,
      where,
      msg,
      locating,
      canLocate,
      addTyped,
      addHere,
      max: MAX_PLOTS,
      editing,
      draft,
      startRename,
      saveName,
      setEditEl,
    };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
.pl-intro {
  margin: 0 0 12px;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.5;
}
.pl-scroll {
  overflow-x: auto;
  margin: 0 0 14px;
}
.pl-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}
.pl-cap {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.pl-table thead th {
  position: relative;
  padding: 0 18px 8px 0;
  text-align: left;
  vertical-align: top;
  font-weight: 600;
  font-size: 13.5px;
  color: var(--accent);
}
.pl-name {
  display: block;
  max-width: 100%;
  padding: 0;
  border: 0;
  border-bottom: 1px dashed transparent;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: text;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pl-name:hover,
.pl-name:focus-visible {
  border-bottom-color: var(--accent);
}
.pl-rename {
  width: 100%;
  padding: 2px 6px;
  font-size: 13.5px;
  font-weight: 600;
}
.pl-coords {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font: 400 10.5px var(--mono);
  text-decoration: none;
}
.pl-coords:hover {
  color: var(--accent);
}
.pl-x {
  position: absolute;
  top: -2px;
  right: 2px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.pl-x:hover {
  color: var(--ink);
  background: var(--track);
}
.pl-label th {
  padding: 10px 0 3px;
  border-top: 1px dashed var(--glass-border);
  color: var(--muted);
  font-weight: 400;
  font-size: 11.5px;
  text-align: left;
}
.pl-label small {
  margin-left: 6px;
  opacity: 0.8;
}
.pl-table td {
  padding: 0 8px 2px 0;
  vertical-align: top;
}
.pl-table td b {
  display: block;
  font-size: 14px;
  font-weight: 600;
}
.pl-table td small {
  display: block;
  color: var(--muted);
  font-size: 11px;
}
/* Drier, or riskier, than is comfortable: the status colour, with the reason in words under the number. */
.pl-table td.pl-low b {
  color: var(--watch);
}
.pl-add {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pl-in {
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
}
.pl-in-name {
  flex: 1 1 90px;
}
.pl-in-where {
  flex: 3 1 200px;
}
.pl-btn {
  padding: 8px 14px;
  border: 1px solid var(--accent);
  border-radius: 99px;
  background: var(--accent);
  color: var(--on-ink);
  font: 600 12.5px var(--sans);
  cursor: pointer;
}
.pl-ghost {
  background: none;
  color: var(--accent);
}
.pl-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.pl-msg {
  margin: 8px 0 0;
  color: var(--ink-2);
  font-size: 12px;
}
.pl-foot {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
</style>
