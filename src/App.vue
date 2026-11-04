<template>
  <div class="page" :data-tick="ui.v">
    <app-header></app-header>
    <p class="status" role="status">{{ ui.status }}</p>
    <main class="cols">
      <div class="col" data-col="main">
        <component v-for="(id, i) in columns.main" :key="id" :is="PANEL_COMPONENTS[id]" :index="i"></component>
      </div>
      <aside class="col" data-col="side">
        <component v-for="(id, i) in columns.side" :key="id" :is="PANEL_COMPONENTS[id]" :index="i + 4"></component>
      </aside>
    </main>
  </div>
  <feeds-dialog></feeds-dialog>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import { ui } from './core/ui-store';
import { panelVisible } from './layout';
import AppHeader from './components/AppHeader.vue';
import MorningBrief from './components/MorningBrief.vue';
import LensPanel from './components/LensPanel.vue';
import SignalPanel from './components/SignalPanel.vue';
import StoriesPanel from './components/StoriesPanel.vue';
import TablePanel from './components/TablePanel.vue';
import CardsPanel from './components/CardsPanel.vue';
import RadarPanel from './components/RadarPanel.vue';
import AlertsPanel from './components/AlertsPanel.vue';
import DatapointsPanel from './components/DatapointsPanel.vue';
import FeedsDialog from './components/FeedsDialog.vue';

const PANEL_COMPONENTS = {
  'p-brief': MorningBrief,
  'p-watch': LensPanel,
  'p-signal': SignalPanel,
  'p-stories': StoriesPanel,
  'p-table': TablePanel,
  'p-multiples': CardsPanel,
  'p-data': DatapointsPanel,
  'p-radar': RadarPanel,
  'p-alerts': AlertsPanel,
};

export default defineComponent({
  name: 'App',
  components: { AppHeader, FeedsDialog },
  setup() {
    const columns = computed(() => {
      ui.v;
      return { main: ui.layout.main.filter(panelVisible), side: ui.layout.side.filter(panelVisible) };
    });
    return { ui, columns, PANEL_COMPONENTS };
  },
});
</script>
