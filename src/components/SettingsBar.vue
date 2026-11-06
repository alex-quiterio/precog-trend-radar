<template>
  <section id="settings" class="settings no-print" aria-label="Settings" @keydown.esc="$emit('close')">
    <div class="set-item">
      <span class="set-label" id="set-theme">Theme</span>
      <span class="seg" role="group" aria-labelledby="set-theme">
        <button v-for="t in themes" :key="t.id" type="button" :aria-pressed="ui.theme === t.id" @click="setTheme(t.id)">
          {{ t.label }}
        </button>
      </span>
    </div>
    <div class="set-item">
      <span class="set-label">Guardian key</span>
      <span class="set-state" :class="guardian.cls">{{ guardian.text }}</span>
      <button class="btn small" type="button" @click="editGuardianKey">
        {{ ui.guardian ? 'Change or remove' : '+ Add key' }}
      </button>
    </div>
    <button class="set-close" type="button" aria-label="Close settings" @click="$emit('close')">×</button>
  </section>
</template>

<script lang="ts">
import { useApp } from '@/context';
import { computed, defineComponent } from 'vue';

// PRECOG / Trend Radar · Settings bar, opened from the header: theme and the Guardian API key.

export default defineComponent({
  name: 'SettingsBar',
  emits: ['close'],
  setup() {
    const { app, actions } = useApp();
    const ui = app.ui;
    const guardian = computed(() => {
      if (!ui.guardian) return { cls: '', text: 'Not set. A free key adds news coverage to each topic.' };
      if (ui.guardianState === 'checking') return { cls: 'checking', text: 'Checking…' };
      if (ui.guardianState === 'error') return { cls: 'error', text: '⚠ ' + ui.guardianNote };
      return { cls: 'ok', text: '✓ ' + (ui.guardianNote || 'Key saved.') };
    });
    return {
      ui,
      guardian,
      themes: [
        { id: 'dark', label: 'Dark' },
        { id: 'light', label: 'Light' },
      ] as const,
      setTheme: actions.setTheme,
      editGuardianKey: actions.editGuardianKey,
    };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
.settings {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 28px;
  padding: 10px 0;
  border-top: 1px solid var(--hair);
}
.set-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  min-width: 0;
}
.set-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.set-state {
  color: var(--ink-2);
  font-size: 12px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.set-state.error {
  color: var(--watch);
}
.set-state.checking {
  opacity: 0.8;
}
.set-close {
  margin-left: auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  font-size: 18px;
  line-height: 1;
}
.set-close:hover {
  color: var(--ink);
  background: var(--accent-soft);
}
/* Phones: one setting per row, the close button top right. */
@media (max-width: 600px) {
  .settings {
    position: relative;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding-right: 34px;
  }
  .set-close {
    position: absolute;
    top: 6px;
    right: 0;
  }
}
</style>
