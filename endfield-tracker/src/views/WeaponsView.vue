<template>
  <PageShell
    page-class="page-weapons"
    hud-left="Weapons"
    hud-right="Owned + Rarity"
    footer="Replace the placeholder weapons list with your real weapon list + images."
  >
    <template #topbar>
      <div class="search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z"
            stroke="white"
            stroke-opacity=".7"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <input v-model.trim="search" placeholder="Search weapons..." />
      </div>

      <div class="pillset" aria-label="Owned filter">
        <button class="pill" :class="{ active: ownedFilter === 'all' }" @click="ownedFilter = 'all'">All</button>
        <button class="pill" :class="{ active: ownedFilter === 'owned' }" @click="ownedFilter = 'owned'">Owned</button>
        <button class="pill" :class="{ active: ownedFilter === 'unowned' }" @click="ownedFilter = 'unowned'">Unowned</button>
      </div>
    </template>

    <div class="controls">
      <div>Owned: <strong>{{ ownedCount }}</strong> / <strong>{{ totalCount }}</strong></div>
      <div>Showing: <strong>{{ shownCount }}</strong></div>
    </div>

    <div class="grid">
      <article
        v-for="weapon in filteredWeapons"
        :key="weapon.id"
        class="card"
        :class="{ unowned: !isOwned(weapon.id) }"
        :style="{ '--rarity': rarityColor(weapon.rarity) }"
      >
        <img class="art" :src="weapon.img" :alt="weapon.name" />
        <div class="fade"></div>
        <div class="owned" @click="toggleOwned(weapon.id)">{{ isOwned(weapon.id) ? "Owned" : "Unowned" }}</div>
        <div class="meta">
          <div>
            <p class="cName">{{ weapon.name }}</p>
            <div class="cStars">{{ stars(weapon.rarity) }}</div>
          </div>
        </div>
      </article>
    </div>
  </PageShell>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import PageShell from "../components/PageShell.vue";
import { weaponsData } from "../data/weapons";
import {
  LS_OWNED_WEAPONS,
  loadOwnedWeapons,
  rarityColor,
  saveOwnedWeapons,
  stars,
} from "../lib/state";

const search = ref("");
const ownedFilter = ref("all");
const ownedMap = ref(loadOwnedWeapons());

const totalCount = computed(() => weaponsData.length);
const ownedCount = computed(() => weaponsData.filter((weapon) => isOwned(weapon.id)).length);

const filteredWeapons = computed(() => {
  const query = search.value.toLowerCase();

  return weaponsData.filter((weapon) => {
    if (ownedFilter.value === "owned" && !isOwned(weapon.id)) {
      return false;
    }

    if (ownedFilter.value === "unowned" && isOwned(weapon.id)) {
      return false;
    }

    if (!query) {
      return true;
    }

    return weapon.name.toLowerCase().includes(query);
  });
});

const shownCount = computed(() => filteredWeapons.value.length);

function isOwned(id) {
  return Boolean(ownedMap.value[id]);
}

function toggleOwned(id) {
  ownedMap.value = {
    ...ownedMap.value,
    [id]: !isOwned(id),
  };

  saveOwnedWeapons(ownedMap.value);
}

function onStorage(event) {
  if (event.key !== LS_OWNED_WEAPONS) {
    return;
  }

  ownedMap.value = loadOwnedWeapons();
}

window.addEventListener("storage", onStorage);
onBeforeUnmount(() => {
  window.removeEventListener("storage", onStorage);
});
</script>
