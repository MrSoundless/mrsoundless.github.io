import { createRouter, createWebHashHistory } from "vue-router";
import RosterView from "./views/RosterView.vue";
import TeamsView from "./views/TeamsView.vue";
import WeaponsView from "./views/WeaponsView.vue";

export const routes = [
  { path: "/", redirect: "/roster" },
  { path: "/roster", name: "roster", component: RosterView },
  { path: "/teams", name: "teams", component: TeamsView },
  { path: "/weapons", name: "weapons", component: WeaponsView },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
