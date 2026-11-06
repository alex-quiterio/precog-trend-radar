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

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
/* panels */
.panel {
  padding: 16px 18px 18px;
  min-width: 0;
  position: relative;
  animation: enter 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(var(--i, 0) * 70ms);
}
@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 8px 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.panel-head h3 {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-2);
}
.panel-head .meta {
  margin-left: auto;
  color: var(--muted);
  font-size: 11px;
  text-align: right;
}
/* Phones */
@media (max-width: 600px) {
  .panel {
    padding: 14px 14px 16px;
  }
}
</style>
