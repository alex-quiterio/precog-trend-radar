<template>
  <svg class="mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <defs>
      <clipPath id="precog-lid"><path d="M5 32C15 15 49 15 59 32C49 49 15 49 5 32Z" /></clipPath>
    </defs>
    <path
      d="M5 32C15 15 49 15 59 32C49 49 15 49 5 32Z"
      stroke="currentColor"
      stroke-width="3"
      stroke-linejoin="round"
    />
    <g clip-path="url(#precog-lid)">
      <circle cx="32" cy="32" r="13" stroke="currentColor" stroke-width="2" />
      <circle cx="32" cy="32" r="7" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.5" />
      <path d="M32 32V19A13 13 0 0 1 41.19 22.81Z" fill="currentColor" fill-opacity="0.22" />
      <path d="M32 32L41.19 22.81" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </g>
    <circle cx="32" cy="32" r="2.6" fill="currentColor" />
    <circle class="blip" cx="36.6" cy="23" r="2" />
  </svg>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

// PRECOG / Trend Radar · The mark: an eye whose iris is a radar, catching a signal before it arrives.

export default defineComponent({ name: 'BrandMark' });
</script>
