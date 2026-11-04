<template>
  <panel-shell id="p-alerts" title="Pre-cog alerts" :meta="view.meta" :index="index" :data-tick="ui.v">
    <transition-group tag="ul" name="alert" class="alerts" aria-live="polite" aria-relevant="additions">
      <li v-for="a in view.list" :key="a.id" class="alert-item" :class="'lvl-' + a.level">
        <div class="a-head">
          <span class="tag" :class="a.level">{{ a.level === 'alert' ? '▲ ALERT' : '◆ WATCH' }}</span>
          <time :datetime="iso(a.t)">{{ fmtTime(a.t, a.step) }}</time>
        </div>
        <div class="a-topic">
          <topic-dot :color="a.color"></topic-dot>
          {{ a.topic }}
          <span class="lensname">{{ a.lens }}</span>
          <span class="z">z = {{ a.z.toFixed(1) }}σ</span>
        </div>
        <div class="zbar" aria-hidden="true"><i :style="{ width: Math.min(100, (a.z / 5) * 100) + '%' }"></i></div>
        <p>{{ a.text }}</p>
      </li>
      <li v-if="!view.list.length" key="empty" class="empty">
        No unusual spikes {{ view.live ? 'in the fetched history' : 'yet' }}. Alerts appear when the latest point is
        more than {{ Z_WATCH }}σ above its {{ BASE_N }}-step baseline.
      </li>
    </transition-group>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { BASE_N, Z_WATCH } from '../core/config';
import { ui } from '../core/ui-store';
import { iso } from '../sources/registry';
import { state } from '../state';
import TopicDot from './TopicDot.vue';
import PanelShell from './PanelShell.vue';

// PRECOG / Trend Radar · Pre-cog alert feed (newest first, capped at 30). New alerts slide in.

export default defineComponent({
  name: 'AlertsPanel',
  props: { index: Number },
  components: { PanelShell, TopicDot },
  setup() {
    const view = computed(() => {
      ui.v;
      const n = state.alerts.filter(a => a.level === 'alert').length;
      return {
        list: state.alerts.slice(),
        meta: `${n} alert · ${state.alerts.length - n} watch · all lenses`,
        live: state.mode === 'live',
      };
    });
    return { ui, view, iso, Z_WATCH, BASE_N };
  },
});
</script>
