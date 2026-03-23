export const LS_TEAMS = "endfieldTeams.v1";
export const LS_OWNED = "endfieldOwned.v1";
export const LS_OWNED_WEAPONS = "endfieldOwnedWeapons.v1";

export const TEAM_SIZE = 4;

function parseOr(fallback, raw) {
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return fallback;
  }
}

export function loadOwnedCharacters() {
  const parsed = parseOr({}, localStorage.getItem(LS_OWNED));
  return parsed && typeof parsed === "object" ? parsed : {};
}

export function saveOwnedCharacters(map) {
  localStorage.setItem(LS_OWNED, JSON.stringify(map));
}

export function loadOwnedWeapons() {
  const parsed = parseOr({}, localStorage.getItem(LS_OWNED_WEAPONS));
  return parsed && typeof parsed === "object" ? parsed : {};
}

export function saveOwnedWeapons(map) {
  localStorage.setItem(LS_OWNED_WEAPONS, JSON.stringify(map));
}

export function loadTeams() {
  const parsed = parseOr([], localStorage.getItem(LS_TEAMS));
  return Array.isArray(parsed) ? parsed : [];
}

export function saveTeams(teams) {
  localStorage.setItem(LS_TEAMS, JSON.stringify(teams));
}

export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function rarityColor(rarity) {
  if (rarity === 6) {
    return "var(--gold)";
  }

  if (rarity === 5) {
    return "var(--purple)";
  }

  return "var(--blue)";
}

export function stars(rarity) {
  return "★".repeat(rarity);
}

export function buildTeamUsage(teams) {
  const usage = new Map();

  for (const team of teams) {
    for (const id of team.members || []) {
      usage.set(id, (usage.get(id) || 0) + 1);
    }
  }

  return usage;
}
