<template>
  <PageShell
    page-class="page-teams"
    hud-left="Team Builder"
    hud-right="Teams are 4 operators"
    footer="Manage your teams by adding and removing members."
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
        <input v-model.trim="search" placeholder="Search roster..." />
      </div>

      <button class="btn primary" id="newTeamBtn" @click="createTeam">New Team</button>
    </template>

    <div class="layout">
      <section class="panel">
        <h2>Teams</h2>
        <div class="teamList">
          <div
            v-for="team in teams"
            :key="team.id"
            class="teamItem"
            :class="{ active: team.id === activeTeamId }"
            @click="setActiveTeam(team.id)"
          >
            <div class="teamMeta">
              <p class="teamName">{{ team.name }}</p>
              <div class="teamSub">{{ team.members.length }} / {{ TEAM_SIZE }} members</div>
            </div>
            <div class="teamActions">
              <button class="iconBtn" title="Select" @click.stop="setActiveTeam(team.id)">Open</button>
              <button class="iconBtn danger" title="Delete" @click.stop="deleteTeam(team.id)">Del</button>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="builderHeader">
          <div class="left">
            <p class="builderTitle">{{ activeTeam ? activeTeam.name : "Select a team" }}</p>
            <div class="builderHint">Add up to 4 members.</div>
          </div>
          <div class="right">
            <button class="btn" :disabled="!activeTeam" @click="clearTeam">Clear</button>
            <button
              class="btn"
              style="border-color: rgba(255,92,122,.26); background: rgba(255,92,122,.10);"
              :disabled="!activeTeam"
              @click="deleteActiveTeam"
            >
              Delete
            </button>
          </div>
        </div>

        <div class="nameEdit">
          <input v-model="teamName" placeholder="Team name..." :disabled="!activeTeam" />
          <button class="btn" :disabled="!activeTeam" @click="saveTeamName">Save</button>
        </div>

        <div class="sectionLabel">Members (4)</div>
        <div class="members">
          <div v-for="slotIndex in TEAM_SIZE" :key="slotIndex" class="slot">
            <div class="slotTitle">Slot {{ slotIndex }}</div>

            <template v-if="activeMembers[slotIndex - 1]">
              <div class="member">
                <div class="mRow">
                  <img class="mImg" :src="operatorById(activeMembers[slotIndex - 1]).img" :alt="operatorById(activeMembers[slotIndex - 1]).name" />
                  <div class="mText">
                    <div class="mName">{{ operatorById(activeMembers[slotIndex - 1]).name }}</div>
                    <div class="mTags">{{ operatorById(activeMembers[slotIndex - 1]).tags.join(" • ") }}</div>
                  </div>
                  <div class="mBtns">
                    <button class="tiny remove" @click.stop="removeMember(activeMembers[slotIndex - 1])">Remove</button>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <span class="emptySlot">Empty</span>
            </template>
          </div>
        </div>

        <div class="rosterSection">
          <div class="rosterHeader">
            <div class="sectionLabel">Roster</div>
            <div class="rosterCount">{{ filteredRoster.length }} shown</div>
          </div>
          <div class="rosterGrid">
            <article
              v-for="op in filteredRoster"
              :key="op.id"
              class="card"
              :style="{ '--rarity': rarityColor(op.rarity) }"
            >
              <img class="art" :src="op.img" :alt="op.name" />
              <div class="fade"></div>
              <button class="add" :disabled="isAddDisabled(op.id)" @click.stop="addMember(op.id)">
                {{ addButtonLabel(op.id) }}
              </button>
              <div class="meta">
                <div>
                  <p class="cName">{{ op.name }}</p>
                  <div class="cStars">{{ stars(op.rarity) }}</div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  </PageShell>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import PageShell from "../components/PageShell.vue";
import { rosterData } from "../data/roster";
import { LS_TEAMS, TEAM_SIZE, loadTeams, rarityColor, saveTeams, stars, uid } from "../lib/state";

const validOperatorIds = new Set(rosterData.map((op) => op.id));
const teams = ref(normalizeTeams(loadTeams()));
const activeTeamId = ref(teams.value[0]?.id ?? null);
const search = ref("");
const teamName = ref("");

ensureStarterTeam();

const activeTeam = computed(() => teams.value.find((team) => team.id === activeTeamId.value) ?? null);
const activeMembers = computed(() => activeTeam.value?.members ?? []);

const filteredRoster = computed(() => {
  const query = search.value.toLowerCase();

  if (!query) {
    return rosterData;
  }

  return rosterData.filter((op) => {
    return op.name.toLowerCase().includes(query) || op.tags.join(" ").toLowerCase().includes(query);
  });
});

watch(
  activeTeam,
  (team) => {
    teamName.value = team?.name ?? "";
  },
  { immediate: true },
);

function ensureStarterTeam() {
  if (teams.value.length) {
    return;
  }

  const starter = { id: uid(), name: "Team 1", members: [] };
  teams.value = [starter];
  activeTeamId.value = starter.id;
  persistTeams();
}

function normalizeTeams(rawTeams) {
  if (!Array.isArray(rawTeams)) {
    return [];
  }

  return rawTeams
    .filter((team) => team && typeof team === "object")
    .map((team) => {
      const members = Array.isArray(team.members)
        ? team.members.filter((id) => validOperatorIds.has(id)).slice(0, TEAM_SIZE)
        : [];

      return {
        id: String(team.id || uid()),
        name: String(team.name || "Untitled Team"),
        members,
      };
    });
}

function persistTeams() {
  saveTeams(teams.value);
}

function setActiveTeam(id) {
  activeTeamId.value = id;
}

function createTeam() {
  const team = {
    id: uid(),
    name: `Team ${teams.value.length + 1}`,
    members: [],
  };

  teams.value = [team, ...teams.value];
  activeTeamId.value = team.id;
  persistTeams();
}

function deleteTeam(id) {
  teams.value = teams.value.filter((team) => team.id !== id);

  if (!teams.value.length) {
    ensureStarterTeam();
    return;
  }

  if (activeTeamId.value === id) {
    activeTeamId.value = teams.value[0].id;
  }

  persistTeams();
}

function deleteActiveTeam() {
  if (!activeTeam.value) {
    return;
  }

  deleteTeam(activeTeam.value.id);
}

function clearTeam() {
  if (!activeTeam.value) {
    return;
  }

  activeTeam.value.members = [];
  teams.value = [...teams.value];
  persistTeams();
}

function saveTeamName() {
  if (!activeTeam.value) {
    return;
  }

  activeTeam.value.name = teamName.value.trim() || "Untitled Team";
  teams.value = [...teams.value];
  persistTeams();
}

function addMember(operatorId) {
  if (!activeTeam.value) {
    return;
  }

  if (activeTeam.value.members.includes(operatorId)) {
    return;
  }

  if (activeTeam.value.members.length >= TEAM_SIZE) {
    return;
  }

  activeTeam.value.members.push(operatorId);
  teams.value = [...teams.value];
  persistTeams();
}

function removeMember(operatorId) {
  if (!activeTeam.value) {
    return;
  }

  activeTeam.value.members = activeTeam.value.members.filter((id) => id !== operatorId);
  teams.value = [...teams.value];
  persistTeams();
}

function isAddDisabled(operatorId) {
  if (!activeTeam.value) {
    return true;
  }

  const alreadyInTeam = activeTeam.value.members.includes(operatorId);
  const teamIsFull = activeTeam.value.members.length >= TEAM_SIZE;
  return alreadyInTeam || teamIsFull;
}

function addButtonLabel(operatorId) {
  if (!activeTeam.value) {
    return "Select Team";
  }

  if (activeTeam.value.members.includes(operatorId)) {
    return "In Team";
  }

  if (activeTeam.value.members.length >= TEAM_SIZE) {
    return "Team Full";
  }

  return "Add";
}

function operatorById(operatorId) {
  return rosterData.find((op) => op.id === operatorId);
}

function onStorage(event) {
  if (event.key !== LS_TEAMS) {
    return;
  }

  teams.value = normalizeTeams(loadTeams());
  activeTeamId.value = teams.value.find((team) => team.id === activeTeamId.value)?.id ?? teams.value[0]?.id ?? null;
  ensureStarterTeam();
}

window.addEventListener("storage", onStorage);
onBeforeUnmount(() => {
  window.removeEventListener("storage", onStorage);
});
</script>
