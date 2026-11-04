<template>
  <section
    ref="el"
    class="panel"
    :class="{ dragging }"
    :id="id"
    :data-panel="id"
    :aria-labelledby="'h-' + id"
    :style="{ '--i': index }"
  >
    <div class="panel-head">
      <button
        class="grip"
        type="button"
        :aria-label="'Move ' + title + ' panel. Drag, or press arrow up or down.'"
        @pointerdown="onGripDown"
        @keydown="onGripKey"
      >
        ⠿
      </button>
      <h2 :id="'h-' + id">{{ title }}</h2>
      <slot name="controls"></slot>
      <span class="meta" v-if="meta">{{ meta }}</span>
    </div>
    <slot></slot>
  </section>
</template>

<script lang="ts">
import { ref, nextTick, defineComponent } from 'vue';
import { ui } from '../core/ui-store';
import { colOf, panelVisible, saveLayout } from '../layout';

export default defineComponent({
  name: 'PanelShell',
  props: { id: String, title: String, meta: String, index: { type: Number, default: 0 } },
  setup(props) {
    const el = ref(null),
      dragging = ref(false);
    function onGripDown(e) {
      e.preventDefault();
      const grip = e.currentTarget,
        col = colOf(props.id);
      grip.setPointerCapture(e.pointerId);
      dragging.value = true;
      const move = ev => {
        const colEl = el.value.parentElement;
        const others = [...colEl.querySelectorAll(':scope > .panel')].filter(p => p !== el.value);
        const before = others.find(p => {
          const r = p.getBoundingClientRect();
          return ev.clientY < r.top + r.height / 2;
        });
        const order = ui.layout[col].filter(id => id !== props.id);
        const at = before ? order.indexOf(before.dataset.panel) : order.length;
        order.splice(at < 0 ? order.length : at, 0, props.id);
        if (order.join() !== ui.layout[col].join()) ui.layout[col] = order;
      };
      const up = () => {
        dragging.value = false;
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        saveLayout();
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    }
    function onGripKey(e) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const col = colOf(props.id),
        order = [...ui.layout[col]];
      const vis = order.filter(panelVisible),
        i = vis.indexOf(props.id),
        j = e.key === 'ArrowUp' ? i - 1 : i + 1;
      if (j < 0 || j >= vis.length) return;
      const a = order.indexOf(props.id),
        b = order.indexOf(vis[j]);
      [order[a], order[b]] = [order[b], order[a]];
      ui.layout[col] = order;
      saveLayout();
      const grip = e.currentTarget;
      nextTick(() => grip.focus());
    }
    return { el, dragging, onGripDown, onGripKey };
  },
});
</script>
