<template>
  <svg
    class="ch-icon"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'globe'">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
    </template>
    <template v-else-if="name === 'leaf'">
      <path d="M5 20c0-9 6-15 15-15 0 9-6 15-15 15z" />
      <path d="M5 20 14 11" />
    </template>
    <path v-else-if="name === 'bolt'" d="M13 2 4 14h7l-1 8 9-12h-7z" />
    <template v-else-if="name === 'land'">
      <path d="M2 20 9 9l4 6 3-4 6 9z" />
      <circle cx="17" cy="5.5" r="2" />
    </template>
    <template v-else-if="name === 'house'">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10M10 20v-5.5h4V20" />
    </template>
    <template v-else-if="name === 'cycle'">
      <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3" />
      <path d="M18 3v3.7h-3.7M6 21v-3.7h3.7" />
    </template>
    <template v-else-if="name === 'bike'">
      <circle cx="5.5" cy="16.5" r="3.5" />
      <circle cx="18.5" cy="16.5" r="3.5" />
      <path d="M5.5 16.5 9.5 9h6l3 7.5M9.5 9 8 6H6M12 16.5 15.5 9" />
    </template>
    <template v-else-if="name === 'book'">
      <path d="M12 6.5C10 5 7 4.5 4 4.5v14c3 0 6 .5 8 2 2-1.5 5-2 8-2v-14c-3 0-6 .5-8 2z" />
      <path d="M12 6.5v14" />
    </template>
    <template v-else-if="name === 'candles'">
      <path d="M7 3v4M7 15v6M17 3v8M17 17v4" />
      <rect x="5" y="7" width="4" height="8" rx="1" />
      <rect x="15" y="11" width="4" height="6" rx="1" />
    </template>
    <path v-else-if="name === 'code'" d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" />
    <path v-else d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z" />
  </svg>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

// PRECOG / Trend Radar · Line icons for the channel bar (24px grid, drawn at 16px).

export default defineComponent({
  name: 'ChannelIcon',
  props: { name: { type: String, default: 'star' } },
});
</script>
