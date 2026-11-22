<template>
  <dialog ref="dlg" class="switcher-dlg" aria-labelledby="sw-h" @close="onClose" @click.self="close">
    <form method="dialog" class="sw-box" @submit.prevent="pick(shown[cur])">
      <header>
        <h3 id="sw-h">Channels</h3>
        <span class="sw-hint">type to find · ↑ ↓ · Enter</span>
      </header>
      <input
        ref="input"
        v-model="q"
        class="sw-find"
        type="search"
        placeholder="Find a channel…"
        aria-label="Find a channel"
        autocomplete="off"
        role="combobox"
        aria-controls="sw-list"
        :aria-activedescendant="shown[cur] ? 'sw-' + shown[cur].id : undefined"
        aria-expanded="true"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
      />
      <ul id="sw-list" class="sw-list" role="listbox" aria-label="Channels">
        <li
          v-for="(c, i) in shown"
          :id="'sw-' + c.id"
          :key="c.id"
          role="option"
          :aria-selected="i === cur"
          :class="{ cur: i === cur, on: c.id === active }"
          @click="pick(c)"
          @mousemove="cur = i"
        >
          <span class="sw-no" aria-hidden="true">{{ c.n <= 9 ? c.n : '' }}</span>
          <channel-icon :name="c.icon"></channel-icon>
          <span class="sw-text">
            <span class="sw-name">
              {{ c.label }}
              <span v-if="c.lensId === home" class="sw-home">home</span>
            </span>
            <span class="sw-kicker">{{ c.kicker }}</span>
          </span>
          <span v-if="c.heat" :class="['sw-heat', c.heat.level]">{{ heatText(c.heat) }}</span>
        </li>
        <li v-if="!shown.length" class="sw-none">No channel matches “{{ q }}”.</li>
      </ul>
    </form>
  </dialog>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, ref, watch } from 'vue';
import { useApp } from '@/context';
import { channels, activeChannel, type Channel } from '@/channels';
import { heatText } from '@components/helpers';
import ChannelIcon from './ChannelIcon.vue';

// PRECOG / Trend Radar · The channel switcher: every channel by name, with its number and its alerts. Opened
// from the header's grid button or with "/"; type to filter, ↑ ↓ to move, Enter or a tap to open.

export default defineComponent({
  name: 'ChannelSwitcher',
  components: { ChannelIcon },
  setup() {
    const { app, actions } = useApp();
    const dlg = ref<HTMLDialogElement | null>(null);
    const input = ref<HTMLInputElement | null>(null);
    const q = ref('');
    const cur = ref(0);
    const all = computed(() =>
      channels(app).map((c, i) => ({ ...c, n: i + 1, heat: actions.lensHeat(app.lensById(c.lensId)) })),
    );
    const shown = computed(() => {
      const s = q.value.trim().toLowerCase();
      return s ? all.value.filter(c => `${c.label} ${c.kicker}`.toLowerCase().includes(s)) : all.value;
    });
    watch(shown, () => (cur.value = 0));
    function open(): void {
      if (!dlg.value || dlg.value.open) return;
      q.value = '';
      const at = all.value.findIndex(c => c.id === activeChannel(app).id);
      cur.value = Math.max(0, at);
      dlg.value.showModal();
      nextTick(() => {
        input.value?.focus();
        document.getElementById('sw-' + shown.value[cur.value]?.id)?.scrollIntoView({ block: 'nearest' });
      });
    }
    function close(): void {
      dlg.value?.close();
    }
    function move(d: number): void {
      const n = shown.value.length;
      if (!n) return;
      cur.value = (cur.value + d + n) % n;
      document.getElementById('sw-' + shown.value[cur.value].id)?.scrollIntoView({ block: 'nearest' });
    }
    function pick(c: Channel | undefined): void {
      if (!c) return;
      actions.selectLens(c.lensId);
      close();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Focus goes back to the button that opened it.
    const onClose = () => document.querySelector<HTMLElement>('.sw-toggle')?.focus();
    return {
      dlg,
      input,
      q,
      cur,
      shown,
      active: computed(() => activeChannel(app).id),
      home: computed(() => app.state.homeLens),
      open,
      close,
      move,
      pick,
      onClose,
      heatText,
    };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
.switcher-dlg {
  width: min(560px, calc(100vw - 32px));
  max-height: min(640px, calc(100vh - 64px));
  margin: 10vh auto auto;
  padding: 0;
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  background: var(--glass-strong);
  color: var(--ink);
}
.switcher-dlg::backdrop {
  background: rgba(0, 0, 0, 0.55);
}
.sw-box {
  display: flex;
  flex-direction: column;
  max-height: inherit;
}
.sw-box header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--glass-border);
}
.sw-box h3 {
  margin: 0;
  font: 600 11px/1.2 var(--mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}
.sw-hint {
  color: var(--muted);
  font: 10.5px var(--mono);
}
.sw-find {
  margin: 10px 14px;
  padding: 8px 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--card);
  outline: none;
}
.sw-find:focus {
  border-color: var(--accent);
}
.sw-list {
  list-style: none;
  margin: 0;
  padding: 0 6px 8px;
  overflow-y: auto;
}
.sw-list li {
  display: grid;
  grid-template-columns: 16px 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius);
  cursor: pointer;
}
.sw-list li.cur {
  background: var(--accent-soft);
}
.sw-list li.on .sw-name {
  color: var(--accent);
}
.sw-no {
  color: var(--muted);
  font: 11px var(--mono);
  text-align: right;
}
.sw-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sw-name {
  font: 500 12px/1.3 var(--mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.sw-home {
  margin-left: 6px;
  padding: 1px 5px;
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  color: var(--accent);
  font-size: 9.5px;
  vertical-align: 1px;
}
.sw-kicker {
  color: var(--muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sw-heat {
  font: 500 10.5px var(--mono);
  padding: 2px 6px;
  border-radius: var(--radius);
  white-space: nowrap;
}
.sw-heat.alert {
  background: var(--alert);
  color: #fff;
}
.sw-heat.watch {
  background: var(--watch);
  color: #1a1300;
}
.sw-none {
  color: var(--muted);
  cursor: default;
}
/* Phones: a sheet rising from the bottom, within the thumb's reach; rows big enough to tap, and a 16px field so
   iOS doesn't zoom in on it. */
@media (max-width: 600px) {
  .switcher-dlg {
    width: 100vw;
    max-width: 100vw;
    max-height: 85vh;
    margin: auto 0 0;
    border-width: 1px 0 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    animation: sw-up 0.2s ease-out both;
  }
  .sw-hint {
    display: none;
  }
  .sw-find {
    font-size: 16px;
    padding: 10px 12px;
  }
  .sw-list li {
    min-height: 52px;
    padding: 8px 10px;
  }
  .sw-name {
    font-size: 13px;
  }
}
@keyframes sw-up {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
}
</style>
