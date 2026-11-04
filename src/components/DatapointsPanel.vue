<template>
  <panel-shell id="p-data" :title="view.title" :meta="view.meta" :index="index" :data-tick="ui.v">
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
        <sparkline v-if="r.spark && r.spark.length > 1" class="dp-spark" :points="r.spark" color="currentColor" fit />
        <span class="src">
          <a :href="r.href" target="_blank" rel="noopener noreferrer">{{ r.src }}</a>
        </span>
      </div>
    </dl>
    <p v-if="!view.rows.length" class="empty">
      {{
        !view.loaded
          ? 'Loading…'
          : view.off
            ? 'This lens shows no datapoints. Switch some on under Lenses → Datapoints.'
            : 'No datapoints could be loaded (offline?).'
      }}
    </p>
  </panel-shell>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { ui } from '../core/ui-store';
import { SOURCE_CATALOG } from '../core/config';
import { dp } from '../features/datapoints';
import { activeLens, lensAllows } from '../state';
import PanelShell from './PanelShell.vue';
import Sparkline from './Sparkline.vue';

// PRECOG / Trend Radar · Datapoints: open data cards for the active lens (updated hourly).

export default defineComponent({
  name: 'DatapointsPanel',
  props: { index: Number },
  components: { PanelShell, Sparkline },
  setup() {
    const view = computed(() => {
      ui.v;
      const lens = activeLens();
      const groups = SOURCE_CATALOG.filter(s => s.kind === 'datapoints' && lensAllows(lens, s.id));
      return {
        title: `Datapoints · ${lens ? lens.name : ''}`,
        rows: dp.rows.filter(r => lensAllows(lens, r.group)),
        off: !groups.length,
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
