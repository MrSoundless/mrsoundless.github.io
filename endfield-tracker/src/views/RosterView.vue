<template>
  <PageShell
    page-class="page-roster"
    hud-left="Roster"
    hud-right="Owned + Team usage"
    footer="Click In Team to open the Teams page."
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
        <input v-model.trim="search" placeholder="Search characters..." />
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
        v-for="op in filteredRoster"
        :key="op.id"
        class="card"
        :class="{ unowned: !isOwned(op.id) }"
        :style="{ '--rarity': rarityColor(op.rarity) }"
      >
        <div
          v-if="teamUsage.get(op.id)"
          class="teamBadge"
          title="Used in teams"
          @click="router.push({ name: 'teams' })"
        >
          In {{ teamUsage.get(op.id) }} team{{ teamUsage.get(op.id) === 1 ? "" : "s" }}
        </div>
        <img class="art" :src="op.img" :alt="op.name" />
        <div class="fade"></div>
        <div class="owned" @click="toggleOwned(op.id)">{{ isOwned(op.id) ? "Owned" : "Unowned" }}</div>
        <div class="meta">
          <div>
            <p class="cName">{{ op.name }}</p>
            <div class="cStars">{{ stars(op.rarity) }}</div>
          </div>
        </div>
      </article>
    </div>
  </PageShell>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import PageShell from "../components/PageShell.vue";
import { rosterData } from "../data/roster";
import {
  LS_OWNED,
  LS_TEAMS,
  buildTeamUsage,
  loadOwnedCharacters,
  loadTeams,
  rarityColor,
  saveOwnedCharacters,
  stars,
} from "../lib/state";

const router = useRouter();
const search = ref("");
const ownedFilter = ref("all");
const ownedMap = ref(loadOwnedCharacters());
const teams = ref(loadTeams());

const teamUsage = computed(() => buildTeamUsage(teams.value));
const totalCount = computed(() => rosterData.length);
const ownedCount = computed(() => rosterData.filter((op) => isOwned(op.id)).length);

const filteredRoster = computed(() => {
  const query = search.value.toLowerCase();

  return rosterData.filter((op) => {
    if (ownedFilter.value === "owned" && !isOwned(op.id)) {
      return false;
    }

    if (ownedFilter.value === "unowned" && isOwned(op.id)) {
      return false;
    }

    if (!query) {
      return true;
    }

    return op.name.toLowerCase().includes(query);
  });
});

const shownCount = computed(() => filteredRoster.value.length);

function isOwned(id) {
  return Boolean(ownedMap.value[id]);
}

function toggleOwned(id) {
  ownedMap.value = {
    ...ownedMap.value,
    [id]: !isOwned(id),
  };
  saveOwnedCharacters(ownedMap.value);
}

function onStorage(event) {
  if (event.key === LS_TEAMS) {
    teams.value = loadTeams();
  }

  if (event.key === LS_OWNED) {
    ownedMap.value = loadOwnedCharacters();
  }
}

window.addEventListener("storage", onStorage);
onBeforeUnmount(() => {
  window.removeEventListener("storage", onStorage);
});
</script>
