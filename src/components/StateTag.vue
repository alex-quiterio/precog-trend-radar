<template>
  <span :class="['tag', t.cls]">{{ t.text }}</span>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { Stats } from '@/types';
import { tagOf } from '@components/helpers';

export default defineComponent({
  name: 'StateTag',
  props: { st: Object as PropType<Pick<Stats, 'z'> | null> },
  computed: {
    t() {
      return tagOf(this.st);
    },
  },
});
</script>
