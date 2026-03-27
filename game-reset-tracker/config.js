window.GAME_RESET_TRACKER_CONFIG = {
  storageKey: "game-reset-tracker-state-v1",
  refreshIntervalMs: 60 * 1000,
  expiringSoonHours: 48,
  urgencyWindowsHours: {
    daily: 4,
    weekly: 24,
  },
  defaultResetSettings: {
    dailyTime: "04:00",
    weeklyDay: 1,
    weeklyTime: "04:00",
  },
  defaultFilters: {
    gameId: "all",
    type: "all",
    state: "all",
    expiringSoon: false,
    hideCompleted: false,
    hideExpired: false,
    sortBy: "time",
  },
  exportConfig: {
    trackerFilename: "game-reset-tracker-export.json",
  },
  importConfig: {
    replaceConfirmMessage: "Replace your entire tracker with this import? This will remove your current local data.",
    invalidFileMessage: "Import failed. Please choose a valid Game Reset Tracker game JSON or full export file.",
    mergeSuccessPrefix: "Imported",
    replaceSuccessPrefix: "Replaced tracker with",
  },
  buildDemoData() {
    const now = new Date();
    const addHours = (hours) => new Date(now.getTime() + hours * 60 * 60 * 1000);
    const addDays = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const toIso = (date) => date.toISOString();
    const toTimeString = (date) => {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    };
    const upcomingDailyTime = (hoursAhead) => toTimeString(addHours(hoursAhead));
    const upcomingWeeklyReset = (hoursAhead) => {
      const target = addHours(hoursAhead);
      return {
        weeklyDay: target.getDay(),
        weeklyTime: toTimeString(target),
      };
    };

    const soonDailyTime = upcomingDailyTime(2);
    const laterDailyTime = upcomingDailyTime(9);
    const soonWeekly = upcomingWeeklyReset(12);
    const laterWeekly = upcomingWeeklyReset(72);
    const closeGroupExpiry = toIso(addHours(18));
    const farGroupExpiry = toIso(addDays(6));
    const closeEventExpiry = toIso(addHours(3));
    const mediumEventExpiry = toIso(addHours(20));
    const farEventExpiry = toIso(addDays(5));

    return {
      games: [
        {
          id: crypto.randomUUID(),
          name: "Astral Odyssey",
          notes: "Demo game with a daily reset close to rolling over.",
          priority: 4,
          expiresAt: null,
          resetSettings: {
            dailyTime: soonDailyTime,
            weeklyDay: laterWeekly.weeklyDay,
            weeklyTime: laterWeekly.weeklyTime,
          },
          groups: [
            {
              id: crypto.randomUUID(),
              name: "Daily Sprint",
              notes: "Daily examples with a reset happening soon.",
              priority: 4,
              expiresAt: closeGroupExpiry,
              resetOverrideEnabled: false,
              resetSettings: {
                dailyTime: null,
                weeklyDay: laterWeekly.weeklyDay,
                weeklyTime: null,
              },
              tasks: [
                {
                  id: crypto.randomUUID(),
                  name: "Spend energy",
                  notes: "This daily task will show an urgent reset countdown.",
                  priority: 5,
                  type: "daily",
                  completedAt: null,
                  expiresAt: null,
                  resetOverrideEnabled: false,
                  resetSettings: {
                    dailyTime: null,
                    weeklyDay: laterWeekly.weeklyDay,
                    weeklyTime: null,
                  },
                },
                {
                  id: crypto.randomUUID(),
                  name: "Check rotating vendor",
                  notes: "This daily task stays outside the urgent reset window.",
                  priority: 3,
                  type: "daily",
                  completedAt: null,
                  expiresAt: null,
                  resetOverrideEnabled: true,
                  resetSettings: {
                    dailyTime: laterDailyTime,
                    weeklyDay: laterWeekly.weeklyDay,
                    weeklyTime: laterWeekly.weeklyTime,
                  },
                },
              ],
            },
            {
              id: crypto.randomUUID(),
              name: "Weekly Push",
              notes: "Weekly examples with one urgent and one non-urgent reset.",
              priority: 3,
              expiresAt: null,
              resetOverrideEnabled: true,
              resetSettings: {
                dailyTime: null,
                weeklyDay: soonWeekly.weeklyDay,
                weeklyTime: soonWeekly.weeklyTime,
              },
              tasks: [
                {
                  id: crypto.randomUUID(),
                  name: "Boss clear",
                  notes: "Weekly task inside the 24-hour urgency window.",
                  priority: 5,
                  type: "weekly",
                  completedAt: null,
                  expiresAt: null,
                  resetOverrideEnabled: false,
                  resetSettings: {
                    dailyTime: null,
                    weeklyDay: soonWeekly.weeklyDay,
                    weeklyTime: null,
                  },
                },
                {
                  id: crypto.randomUUID(),
                  name: "Raid prep route",
                  notes: "Weekly task outside the urgency window.",
                  priority: 3,
                  type: "weekly",
                  completedAt: null,
                  expiresAt: null,
                  resetOverrideEnabled: true,
                  resetSettings: {
                    dailyTime: null,
                    weeklyDay: laterWeekly.weeklyDay,
                    weeklyTime: laterWeekly.weeklyTime,
                  },
                },
              ],
            },
            {
              id: crypto.randomUUID(),
              name: "Constellation Event",
              notes: "Event group with both near and far expirations.",
              priority: 5,
              expiresAt: farGroupExpiry,
              resetOverrideEnabled: false,
              resetSettings: {
                dailyTime: null,
                weeklyDay: laterWeekly.weeklyDay,
                weeklyTime: null,
              },
              tasks: [
                {
                  id: crypto.randomUUID(),
                  name: "Claim limited daily shard",
                  notes: "Event task with a clearly visible urgent countdown.",
                  priority: 5,
                  type: "event",
                  completedAt: null,
                  expiresAt: closeEventExpiry,
                  resetOverrideEnabled: false,
                  resetSettings: {
                    dailyTime: null,
                    weeklyDay: laterWeekly.weeklyDay,
                    weeklyTime: null,
                  },
                },
                {
                  id: crypto.randomUUID(),
                  name: "Finish bonus challenge track",
                  notes: "Event task that is not close to expiring yet.",
                  priority: 4,
                  type: "event",
                  completedAt: null,
                  expiresAt: farEventExpiry,
                  resetOverrideEnabled: false,
                  resetSettings: {
                    dailyTime: null,
                    weeklyDay: laterWeekly.weeklyDay,
                    weeklyTime: null,
                  },
                },
              ],
            },
          ],
          tasks: [],
        },
        {
          id: crypto.randomUUID(),
          name: "Echo Frontier",
          notes: "Demo game with group-level and event expiration examples.",
          priority: 3,
          expiresAt: null,
          resetSettings: {
            dailyTime: laterDailyTime,
            weeklyDay: soonWeekly.weeklyDay,
            weeklyTime: soonWeekly.weeklyTime,
          },
          groups: [
            {
              id: crypto.randomUUID(),
              name: "Character Growth",
              notes: "Contains a group close to expiring plus mixed task urgency.",
              priority: 3,
              expiresAt: closeGroupExpiry,
              resetOverrideEnabled: true,
              resetSettings: {
                dailyTime: soonDailyTime,
                weeklyDay: soonWeekly.weeklyDay,
                weeklyTime: soonWeekly.weeklyTime,
              },
              tasks: [
                {
                  id: crypto.randomUUID(),
                  name: "Craft potion stock",
                  notes: "One-time task inside a group that is close to expiring.",
                  priority: 2,
                  type: "one-time",
                  completedAt: null,
                  expiresAt: null,
                  resetOverrideEnabled: false,
                  resetSettings: {
                    dailyTime: null,
                    weeklyDay: soonWeekly.weeklyDay,
                    weeklyTime: null,
                  },
                },
                {
                  id: crypto.randomUUID(),
                  name: "Double-drop dungeon",
                  notes: "Event that expires within the countdown window.",
                  priority: 4,
                  type: "event",
                  completedAt: null,
                  expiresAt: mediumEventExpiry,
                  resetOverrideEnabled: false,
                  resetSettings: {
                    dailyTime: null,
                    weeklyDay: soonWeekly.weeklyDay,
                    weeklyTime: null,
                  },
                },
              ],
            },
          ],
          tasks: [
            {
              id: crypto.randomUUID(),
              name: "Ungrouped event briefing",
              notes: "Direct-to-game task with a far countdown for the ungrouped section.",
              priority: 2,
              type: "event",
              completedAt: null,
              expiresAt: farEventExpiry,
              resetOverrideEnabled: false,
              resetSettings: {
                dailyTime: null,
                weeklyDay: soonWeekly.weeklyDay,
                weeklyTime: null,
              },
            },
          ],
        },
      ],
    };
  },
};
