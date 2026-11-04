<template>
  <section class="panel" :id="id" :aria-labelledby="'h-' + id" :style="{ '--i': index }">
    <div class="panel-head">
      <h3 :id="'h-' + id">{{ title }}</h3>
      <slot name="controls"></slot>
      <span v-if="meta" class="meta">{{ meta }}</span>
    </div>
    <slot></slot>
  </section>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

// PRECOG / Trend Radar · A card: a titled panel with optional controls and a meta line.

export default defineComponent({
  name: 'PanelShell',
  props: { id: String, title: String, meta: String, index: { type: Number, default: 0 } },
});
</script>
