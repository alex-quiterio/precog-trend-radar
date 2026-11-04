<template>
  <span :class="['tag', t.cls]">{{ t.text }}</span>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { tagOf } from './helpers';

export default defineComponent({
  name: 'StateTag',
  props: { st: Object },
  computed: {
    t() {
      return tagOf(this.st);
    },
  },
});
</script>
