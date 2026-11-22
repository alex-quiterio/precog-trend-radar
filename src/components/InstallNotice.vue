<template>
  <aside v-if="state.open" class="install no-print" role="dialog" aria-modal="false" aria-labelledby="install-h">
    <header>
      <h3 id="install-h">Install PRECOG</h3>
      <button class="install-x" type="button" aria-label="Not now" title="Not now" @click="later">
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </button>
    </header>
    <p v-if="state.way === 'prompt'">Keep the situation room one click away: it opens in its own window.</p>
    <!-- prettier-ignore -->
    <p v-else-if="state.way === 'ios'">Add it to your Home Screen: tap <b>Share</b>&nbsp;<svg class="share" viewBox="0 0 16 16" width="13" height="13" aria-label="(the square with an arrow)"><path d="M8 1.5v8M5 4.5l3-3 3 3M4.5 7H3.5v7h9V7h-1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>, then <b>Add to Home Screen</b>.</p>
    <!-- prettier-ignore -->
    <p v-else>Add it to your Dock: in Safari's menu bar, choose <b>File › Add to Dock</b>.</p>
    <div class="install-actions">
      <button v-if="state.way === 'prompt'" class="btn primary small" type="button" @click="install">Install</button>
      <button v-else class="btn primary small" type="button" @click="done">Done</button>
      <button class="btn small" type="button" @click="later">Not now</button>
    </div>
  </aside>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted } from 'vue';
import { createInstall } from '@features/install';

// PRECOG / Trend Radar · A small notice asking to install PRECOG as an app (see features/install.ts).

export default defineComponent({
  name: 'InstallNotice',
  setup() {
    const { state, start, stop, install, later, done } = createInstall();
    onMounted(start);
    onUnmounted(stop);
    return { state, install, later, done };
  },
});
</script>

<style>
/* This panel's styles. Global (not scoped), like the rest of the page: class names are specific to it. */
.install {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 30;
  width: 300px;
  max-width: calc(100vw - 32px);
  padding: 0 14px 14px;
  background: var(--glass-strong);
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  animation: install-in 0.25s ease-out both;
}
@keyframes install-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
.install header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 -14px 10px;
  padding: 8px 8px 8px 14px;
  border-bottom: 1px solid var(--glass-border);
}
.install h3 {
  margin: 0;
  font: 600 11px/1.2 var(--mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}
.install-x {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.install-x:hover {
  color: var(--ink);
}
.install p {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--ink-2);
}
.install p b {
  color: var(--ink);
  font-weight: 600;
}
.install .share {
  vertical-align: -2px;
  color: var(--accent);
}
.install-actions {
  display: flex;
  gap: 8px;
}
/* Phones: across the bottom, clear of the home bar. */
@media (max-width: 600px) {
  .install {
    left: 16px;
    right: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    width: auto;
  }
}
</style>
