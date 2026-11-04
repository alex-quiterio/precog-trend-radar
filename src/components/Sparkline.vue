<template>
  <svg ref="el" :viewBox="'0 0 ' + g.w + ' ' + g.h" aria-hidden="true">
    <template v-if="g.d">
      <line x1="0" :x2="g.w" :y1="g.h - 5" :y2="g.h - 5" class="base" />
      <path :d="g.d" fill="none" :stroke="color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle :cx="g.cx" :cy="g.cy" r="4" :fill="color" style="stroke: var(--ring)" stroke-width="2" />
    </template>
    <text v-else x="0" y="24" class="yl">{{ note || 'waiting…' }}</text>
  </svg>
</template>

<script lang="ts">
import { ref, computed, defineComponent, type PropType } from 'vue';
import type { SeriesPoint } from '../types';
import { pathOf, useWidth } from './helpers';

// PRECOG / Trend Radar · Small-multiple cards (sparkline, value, momentum) for the active lens.

export default defineComponent({
  name: 'Sparkline',
  props: {
    points: { type: Array as PropType<SeriesPoint[]>, default: () => [] },
    color: String,
    note: String,
    /** Scale to the series' own min–max instead of from zero (for slow numbers like CO₂). */
    fit: Boolean,
  },
  setup(props) {
    const el = ref(null),
      width = useWidth(el, 150);
    const g = computed(() => {
      const s = props.points || [],
        w = Math.max(60, width.value),
        h = 40;
      if (s.length < 2) return { w, h };
      const vals = s.map(p => p.value),
        max = Math.max(...vals),
        min = props.fit ? Math.min(...vals) : 0,
        span = max - min || 1;
      const X = k => 2 + (k / (s.length - 1)) * (w - 8),
        Y = v => h - 5 - ((v - min) / span) * (h - 10);
      return {
        w,
        h,
        d: pathOf(s.map((p, k) => [X(k), Y(p.value)])),
        cx: X(s.length - 1),
        cy: Y(s[s.length - 1].value),
      };
    });
    return { el, g };
  },
});
</script>
