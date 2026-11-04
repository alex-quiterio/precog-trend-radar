<template>
  <span class="dot" :style="{ background: color }" aria-hidden="true"></span>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'TopicDot',
  props: { color: String },
});
</script>
