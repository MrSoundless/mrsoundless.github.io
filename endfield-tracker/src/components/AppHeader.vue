<template>
  <header>
    <div class="hud">
      <div class="left"><span class="dot"></span><span>{{ hudLeft }}</span></div>
      <div class="right">{{ hudRight }}</div>
    </div>

    <div class="topbar">
      <div class="brand">
        <div class="logo"></div>
        <div>
          <h1>Endfield Tracker</h1>
        </div>
      </div>

      <div class="nav">
        <RouterLink :to="{ name: 'roster' }" class="nav-link" :class="{ active: route.name === 'roster' }">
          Roster
        </RouterLink>
        <RouterLink :to="{ name: 'teams' }" class="nav-link" :class="{ active: route.name === 'teams' }">
          Teams
        </RouterLink>
        <RouterLink :to="{ name: 'weapons' }" class="nav-link" :class="{ active: route.name === 'weapons' }">
          Weapons
        </RouterLink>
      </div>

      <slot />
    </div>
  </header>
</template>

<script setup>
import { RouterLink, useRoute } from "vue-router";

defineProps({
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
});

const route = useRoute();
</script>
