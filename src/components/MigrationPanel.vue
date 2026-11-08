<template>
  <panel-shell id="p-flyway" title="The flyway, north to south" :meta="meta" :index="index">
    <ul v-if="notes.length" class="fw-notes">
      <li v-for="(n, i) in notes" :key="i">{{ n }}</li>
    </ul>

    <ol class="fw-route" aria-label="Weather radars along the East Atlantic flyway, north to south">
      <template v-for="(s, i) in rows" :key="s.radar">
        <li v-if="i > 0 && s.to !== rows[i - 1].to" class="fw-gap">{{ gap }}</li>
        <li class="fw-stop" :class="{ 'fw-city': s.near }">
          <div class="fw-line">
            <svg
              v-if="s.heading != null"
              class="fw-arrow"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              :style="{ transform: `rotate(${s.heading}deg)` }"
              role="img"
              :aria-label="`heading ${s.way}`"
            >
              <path d="M12 3v18M12 3l-6 6M12 3l6 6" />
            </svg>
            <span v-else class="fw-arrow fw-none" aria-hidden="true">·</span>
            <span class="fw-place">
              <b>{{ s.site }}</b>
              <small>{{ s.where }}{{ s.near ? ` · near ${s.near}` : '' }}</small>
            </span>
            <span class="fw-num">{{ s.value }}</span>
          </div>
          <div class="fw-bar" aria-hidden="true"><i :style="{ width: s.bar + '%' }"></i></div>
          <p class="fw-sub">
            <span v-for="(p, i) in s.parts" :key="i">{{ p }}</span>
            <span v-if="s.vs.text" :class="'fw-' + s.vs.dir">{{ s.vs.text }}</span>
          </p>
        </li>
      </template>
    </ol>

    <p class="fw-foot">
      Birds crossing each km of a line across their path between sunset and sunrise, measured by weather radars (Aloft,
      open European radar data). Each radar sees about 100 km around it; files arrive a day or two late. Arrows point
      where the birds fly.
    </p>
  </panel-shell>
</template>

<script lang="ts">
import { useApp } from '@/context';
import { computed, defineComponent, onBeforeUnmount, onMounted } from 'vue';
import { ago, nf0 } from '@core/format';
import { compass } from '@sources/aloft';
import { GAP, createMigration, flywayNotes, perKm, versus } from '@features/migration';
import PanelShell from '@components/PanelShell.vue';

// PRECOG / Trend Radar · Bird migration's flyway: the radars from the North Sea to the Algarve, each with its latest night's
// birds, their heading, and a bar against the busiest. Loads while the Bird migration channel is on screen.

export default defineComponent({
  name: 'MigrationPanel',
  components: { PanelShell },
  props: { index: { type: Number, default: 0 } },
  setup() {
    const { app } = useApp();
    const ui = app.ui;
    const flyway = createMigration();
    const st = flyway.state;
    onMounted(() => void flyway.load());
    onBeforeUnmount(() => flyway.stop());
    const notes = computed(() => flywayNotes(st.stations));
    const rows = computed(() => {
      const top = Math.max(1, ...st.stations.map(s => s.data?.day.birdsPerKm ?? 0));
      return st.stations.map(s => {
        const d = s.data?.day;
        const at = (t: number) =>
          new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: s.tz });
        const date =
          d && new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const parts = d
          ? [
              date!,
              d.heading != null && d.speedKmh != null
                ? `${compass(d.heading)} at ${nf0.format(d.speedKmh)} km/h`
                : 'no clear heading',
              d.heightM != null ? `~${nf0.format(Math.round(d.heightM / 100) * 100)} m up` : '',
              d.peak.mtr > 0 ? `busiest ${at(d.peak.t)}` : '',
            ].filter(Boolean)
          : [s.error ? `not loaded: ${s.error}` : 'reading the radar…'];
        return {
          ...s,
          heading: d?.heading ?? null,
          way: d?.heading != null ? compass(d.heading) : '',
          value: d ? perKm(d.birdsPerKm) : '–',
          bar: d ? (d.birdsPerKm / top) * 100 : 0,
          parts,
          vs: s.data ? versus(s.data) : { text: '', dir: '' },
        };
      });
    });
    const meta = computed(() => (st.at ? `checked ${ago(st.at, ui.now)}` : st.loading ? 'reading the radars…' : ''));
    return { notes, rows, meta, gap: GAP };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
.fw-notes {
  margin: 0 0 14px;
  padding: 12px 14px 12px 30px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: var(--card);
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.5;
}
.fw-notes li + li {
  margin-top: 4px;
}
.fw-route {
  margin: 0;
  padding: 0;
  list-style: none;
  position: relative;
}
/* The route itself: a thin line joining the stops, north to south. */
.fw-route::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 14px;
  bottom: 14px;
  width: 1px;
  background: var(--glass-border);
}
.fw-stop {
  position: relative;
  padding: 8px 0 10px;
}
.fw-stop + .fw-stop {
  border-top: 1px dashed var(--glass-border);
}
.fw-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.fw-arrow {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--card);
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.fw-none {
  display: grid;
  place-items: center;
  color: var(--muted);
}
.fw-place {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.fw-place b {
  font-size: 14px;
}
.fw-place small {
  color: var(--muted);
  font-size: 11.5px;
}
.fw-city .fw-place b {
  color: var(--accent);
}
.fw-num {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 15px;
  font-weight: 600;
}
.fw-bar {
  height: 4px;
  margin: 6px 0 0 30px;
  border-radius: 99px;
  background: var(--track);
  overflow: hidden;
}
.fw-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.6s ease;
}
.fw-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin: 5px 0 0 30px;
  color: var(--muted);
  font-size: 11.5px;
}
.fw-gap {
  margin: 0 0 0 30px;
  padding: 8px 0;
  border-top: 1px dashed var(--glass-border);
  color: var(--muted);
  font-size: 11.5px;
  font-style: italic;
}
.fw-up {
  color: var(--accent);
}
.fw-foot {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
</style>
