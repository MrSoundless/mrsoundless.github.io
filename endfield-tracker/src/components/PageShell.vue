<template>
  <div class="wrap" :class="pageClass">
    <AppHeader :hud-left="hudLeft" :hud-right="hudRight" :subtitle="subtitle">
      <slot name="topbar" />
    </AppHeader>

    <slot />

    <div class="footer">{{ footer }}</div>
  </div>
</template>

<script setup>
import AppHeader from "./AppHeader.vue";

defineProps({
  pageClass: {
    type: String,
    default: "",
  },
  hudLeft: {
    type: String,
    required: true,
  },
  hudRight: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    required: true,
  },
  footer: {
    type: String,
    required: true,
  },
});
</script>
