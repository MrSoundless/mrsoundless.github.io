(function () {
  const CONFIG = window.GAME_RESET_TRACKER_CONFIG || {
    storageKey: "game-reset-tracker-state-v1",
    uiPrefsKey: "game-reset-tracker-ui-prefs-v1",
    refreshIntervalMs: 60 * 1000,
    docsBaseUrl: "",
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
      disabledMode: "hide",
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
      return { games: [] };
    },
  };

  const uiPrefs = loadUiPrefs();

  const state = {
    data: loadState(),
    filters: createDefaultFilters(uiPrefs.filters),
    theme: uiPrefs.theme || "light",
    view: {
      mode: "global",
      gameId: null,
      groupKey: null,
    },
    editor: null,
    expandedGameGroups: uiPrefs.expandedGameGroups || {},
    collapsedGroups: uiPrefs.collapsedGroups || {},
    collapsedPanels: {
      filters: false,
      data: false,
      games: false,
      ...((uiPrefs && uiPrefs.collapsedPanels) || {}),
    },
  };

  const elements = {
    filtersForm: document.getElementById("filtersForm"),
    filterGame: document.getElementById("filterGame"),
    filterType: document.getElementById("filterType"),
    filterState: document.getElementById("filterState"),
    filterExpiringSoon: document.getElementById("filterExpiringSoon"),
    filterDisabledMode: document.getElementById("filterDisabledMode"),
    hideCompleted: document.getElementById("hideCompleted"),
    hideExpired: document.getElementById("hideExpired"),
    sortBy: document.getElementById("sortBy"),
    resetFiltersButton: document.getElementById("resetFiltersButton"),
    themeToggleButton: document.getElementById("themeToggleButton"),
    guideLink: document.getElementById("guideLink"),
    addGameButton: document.getElementById("addGameButton"),
    exportButton: document.getElementById("exportButton"),
    googleDriveStatus: document.getElementById("googleDriveStatus"),
    googleConnectButton: document.getElementById("googleConnectButton"),
    googleSaveButton: document.getElementById("googleSaveButton"),
    googleLoadButton: document.getElementById("googleLoadButton"),
    googleDisconnectButton: document.getElementById("googleDisconnectButton"),
    importInput: document.getElementById("importInput"),
    importMode: document.getElementById("importMode"),
    resetDemoButton: document.getElementById("resetDemoButton"),
    resetProgressButton: document.getElementById("resetProgressButton"),
    hero: document.querySelector(".hero"),
    heroTitle: document.getElementById("heroTitle"),
    heroSubtitle: document.getElementById("heroSubtitle"),
    heroStats: document.getElementById("heroStats"),
    listTitle: document.getElementById("listTitle"),
    contextActions: document.getElementById("contextActions"),
    emptyState: document.getElementById("emptyState"),
    taskList: document.getElementById("taskList"),
    gamesList: document.getElementById("gamesList"),
    gamesPanel: document.getElementById("gamesPanel"),
    editorHost: document.getElementById("editorHost"),
    editorPanel: document.getElementById("editorPanel"),
    sideColumn: document.getElementById("sideColumn"),
    sidebarAux: document.getElementById("sidebarAux"),
    editorTemplate: document.getElementById("editorTemplate"),
    confirmModal: document.getElementById("confirmModal"),
    confirmTitle: document.getElementById("confirmTitle"),
    confirmMessage: document.getElementById("confirmMessage"),
    confirmCancelButton: document.getElementById("confirmCancelButton"),
    confirmAcceptButton: document.getElementById("confirmAcceptButton"),
  };

  let confirmationState = null;
  const twoColumnRailMedia = window.matchMedia("(max-width: 1500px) and (min-width: 901px)");
  const googleDriveState = {
    accessToken: null,
    tokenClient: null,
    initialized: false,
  };

  bindEvents();
  initializeIntegrations();
  applyTheme();
  applyGuideLink();
  syncResponsivePanels();
  render();
  setInterval(render, CONFIG.refreshIntervalMs);

  function createDefaultFilters(savedFilters) {
    return { ...CONFIG.defaultFilters, ...(savedFilters || {}) };
  }

  function createDefaultResetSettings() {
    return { ...CONFIG.defaultResetSettings };
  }

  function loadUiPrefs() {
    try {
      const raw = localStorage.getItem(CONFIG.uiPrefsKey);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function saveUiPrefs() {
    localStorage.setItem(CONFIG.uiPrefsKey, JSON.stringify({
      theme: state.theme,
      filters: state.filters,
      expandedGameGroups: state.expandedGameGroups,
      collapsedGroups: state.collapsedGroups,
      collapsedPanels: state.collapsedPanels,
    }));
  }

  function applyTheme() {
    document.body.dataset.theme = state.theme;
    if (elements.themeToggleButton) {
      elements.themeToggleButton.textContent = state.theme === "dark" ? "Light mode" : "Dark mode";
    }
  }

  function applyGuideLink() {
    if (!elements.guideLink) {
      return;
    }

    const baseUrl = String(CONFIG.docsBaseUrl || "").trim();
    elements.guideLink.href = baseUrl
      ? `${baseUrl.replace(/\/?$/, "/")}game-reset-tracker/README.md`
      : "./README.md";
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
    saveUiPrefs();
  }

  function openConfirmation(options) {
    confirmationState = {
      title: options.title || "Are you sure?",
      message: options.message || "",
      confirmLabel: options.confirmLabel || "Confirm",
      danger: Boolean(options.danger),
      onConfirm: options.onConfirm,
    };
    renderConfirmation();
  }

  function renderConfirmation() {
    if (!confirmationState) {
      elements.confirmModal.hidden = true;
      return;
    }

    elements.confirmTitle.textContent = confirmationState.title;
    elements.confirmMessage.textContent = confirmationState.message;
    elements.confirmAcceptButton.textContent = confirmationState.confirmLabel;
    elements.confirmAcceptButton.classList.toggle("danger", confirmationState.danger);
    elements.confirmModal.hidden = false;
  }

  function closeConfirmation() {
    confirmationState = null;
    elements.confirmAcceptButton.classList.remove("danger");
    elements.confirmModal.hidden = true;
  }

  function confirmCurrentAction() {
    if (!confirmationState) {
      return;
    }
    const action = confirmationState.onConfirm;
    closeConfirmation();
    if (typeof action === "function") {
      action();
    }
  }

  function bindEvents() {
    elements.filtersForm.addEventListener("input", syncFiltersFromForm);
    elements.filtersForm.addEventListener("change", syncFiltersFromForm);
    elements.resetFiltersButton.addEventListener("click", resetFilters);
    elements.themeToggleButton.addEventListener("click", toggleTheme);
    elements.addGameButton.addEventListener("click", () => openEditor({ mode: "create", entityType: "game", parentType: null, parentId: null }));
    elements.exportButton.addEventListener("click", exportJson);
    elements.googleConnectButton.addEventListener("click", connectGoogleDrive);
    elements.googleSaveButton.addEventListener("click", saveBackupToGoogleDrive);
    elements.googleLoadButton.addEventListener("click", loadBackupFromGoogleDrive);
    elements.googleDisconnectButton.addEventListener("click", disconnectGoogleDrive);
    elements.importInput.addEventListener("change", importJson);
    elements.resetProgressButton.addEventListener("click", requestResetProgress);
    elements.resetDemoButton.addEventListener("click", requestRestoreDemo);
    bindPanelToggles();
    bindConfirmationModal();
    if (twoColumnRailMedia.addEventListener) {
      twoColumnRailMedia.addEventListener("change", syncResponsivePanels);
    } else if (twoColumnRailMedia.addListener) {
      twoColumnRailMedia.addListener(syncResponsivePanels);
    }
  }

  function syncResponsivePanels() {
    const target = twoColumnRailMedia.matches ? elements.sidebarAux : elements.sideColumn;
    if (!target) {
      return;
    }

    [elements.gamesPanel, elements.editorPanel].forEach((panel) => {
      if (panel && panel.parentElement !== target) {
        target.appendChild(panel);
      }
    });
  }

  function initializeIntegrations() {
    initializeGoogleDriveIntegration();
    initializeClarity();
  }

  function bindConfirmationModal() {
    elements.confirmCancelButton.addEventListener("click", closeConfirmation);
    elements.confirmAcceptButton.addEventListener("click", confirmCurrentAction);
    elements.confirmModal.addEventListener("click", (event) => {
      if (event.target === elements.confirmModal) {
        closeConfirmation();
      }
    });
  }

  function initializeGoogleDriveIntegration() {
    if (!CONFIG.googleDrive || !CONFIG.googleDrive.clientId || !window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      updateGoogleDriveStatus("Google Drive sync is unavailable until a Google client ID is configured.");
      setGoogleDriveButtonsDisabled(true);
      return;
    }

    googleDriveState.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.googleDrive.clientId,
      scope: CONFIG.googleDrive.scope,
      callback: () => {},
    });
    googleDriveState.initialized = true;
    updateGoogleDriveStatus("Google Drive sync is ready. Connect to save or load your tracker backup.");
    setGoogleDriveButtonsDisabled(false);
  }

  function initializeClarity() {
    const projectId = CONFIG.clarity && CONFIG.clarity.projectId;
    if (!projectId || isLocalOrPrivateHost(window.location.hostname)) {
      return;
    }

    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", projectId);
  }

  function isLocalOrPrivateHost(hostname) {
    const normalized = String(hostname || "").toLowerCase();
    if (!normalized) {
      return true;
    }

    return normalized === "localhost"
      || normalized === "127.0.0.1"
      || normalized === "::1"
      || normalized.endsWith(".local")
      || normalized.startsWith("10.")
      || normalized.startsWith("192.168.")
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
  }

  function updateGoogleDriveStatus(message) {
    elements.googleDriveStatus.textContent = message;
  }

  function setGoogleDriveButtonsDisabled(disabled) {
    elements.googleConnectButton.disabled = disabled;
    elements.googleSaveButton.disabled = disabled;
    elements.googleLoadButton.disabled = disabled;
    elements.googleDisconnectButton.disabled = disabled;
  }

  function connectGoogleDrive() {
    if (!googleDriveState.initialized) {
      updateGoogleDriveStatus("Google Drive sync is unavailable until a Google client ID is configured.");
      return;
    }

    googleDriveState.tokenClient.callback = (response) => {
      if (response && response.access_token) {
        googleDriveState.accessToken = response.access_token;
        updateGoogleDriveStatus("Connected to Google Drive. You can now save or load your tracker backup.");
      }
    };

    googleDriveState.tokenClient.requestAccessToken({ prompt: googleDriveState.accessToken ? "" : "consent" });
  }

  function disconnectGoogleDrive() {
    googleDriveState.accessToken = null;
    updateGoogleDriveStatus("Disconnected from Google Drive.");
  }

  async function saveBackupToGoogleDrive() {
    const token = await ensureGoogleDriveToken();
    if (!token) {
      return;
    }

    try {
      const existingFileId = await findGoogleDriveBackupFileId(token);
      const payload = JSON.stringify({
        savedAt: new Date().toISOString(),
        data: state.data,
        uiPrefs: {
          filters: state.filters,
          collapsedGroups: state.collapsedGroups,
          collapsedPanels: state.collapsedPanels,
        },
      }, null, 2);
      const metadata = {
        name: CONFIG.googleDrive.backupFileName,
        parents: ["appDataFolder"],
      };

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", new Blob([payload], { type: "application/json" }));

      const url = existingFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
        : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
      const method = existingFileId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (!response.ok) {
        throw new Error("Failed to save backup");
      }

      updateGoogleDriveStatus("Tracker backup saved to Google Drive.");
    } catch (error) {
      updateGoogleDriveStatus("Google Drive save failed. Check your client ID and Drive permissions.");
    }
  }

  async function loadBackupFromGoogleDrive() {
    const token = await ensureGoogleDriveToken();
    if (!token) {
      return;
    }

    try {
      const existingFileId = await findGoogleDriveBackupFileId(token);
      if (!existingFileId) {
        updateGoogleDriveStatus("No Google Drive backup was found for this app yet.");
        return;
      }

      openConfirmation({
        title: "Load backup from Drive",
        message: "Replace your current local tracker with the backup stored in Google Drive?",
        confirmLabel: "Load backup",
        danger: true,
        onConfirm: async () => {
          try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFileId}?alt=media`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (!response.ok) {
              throw new Error("Failed to load backup");
            }
            const backup = await response.json();
            if (!backup || !backup.data || !Array.isArray(backup.data.games)) {
              throw new Error("Invalid backup format");
            }

            state.data = backup.data;
            state.filters = backup.uiPrefs && backup.uiPrefs.filters
              ? createDefaultFilters(backup.uiPrefs.filters)
              : state.filters;
            state.collapsedGroups = backup.uiPrefs && backup.uiPrefs.collapsedGroups ? backup.uiPrefs.collapsedGroups : state.collapsedGroups;
            state.collapsedPanels = backup.uiPrefs && backup.uiPrefs.collapsedPanels
              ? { ...state.collapsedPanels, ...backup.uiPrefs.collapsedPanels }
              : state.collapsedPanels;
            saveState();
            saveUiPrefs();
            applyPanelCollapseState();
            render();
            updateGoogleDriveStatus("Loaded tracker backup from Google Drive.");
          } catch (error) {
            updateGoogleDriveStatus("Google Drive load failed. The stored backup could not be applied.");
          }
        },
      });
    } catch (error) {
      updateGoogleDriveStatus("Google Drive load failed. Check your client ID and Drive permissions.");
    }
  }

  async function ensureGoogleDriveToken() {
    if (googleDriveState.accessToken) {
      return googleDriveState.accessToken;
    }

    if (!googleDriveState.initialized) {
      updateGoogleDriveStatus("Google Drive sync is unavailable until a Google client ID is configured.");
      return null;
    }

    return new Promise((resolve) => {
      googleDriveState.tokenClient.callback = (response) => {
        if (response && response.access_token) {
          googleDriveState.accessToken = response.access_token;
          updateGoogleDriveStatus("Connected to Google Drive.");
          resolve(response.access_token);
          return;
        }
        resolve(null);
      };
      googleDriveState.tokenClient.requestAccessToken({ prompt: "consent" });
    });
  }

  async function findGoogleDriveBackupFileId(token) {
    const query = encodeURIComponent(`name='${CONFIG.googleDrive.backupFileName}' and 'appDataFolder' in parents and trashed=false`);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,name)`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error("Failed to query backup file");
    }
    const payload = await response.json();
    return payload.files && payload.files[0] ? payload.files[0].id : null;
  }

  function bindPanelToggles() {
    document.querySelectorAll("[data-toggle-panel]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.togglePanel;
        state.collapsedPanels[key] = !state.collapsedPanels[key];
        saveUiPrefs();
        applyPanelCollapseState();
      });
    });
    applyPanelCollapseState();
  }

  function applyPanelCollapseState() {
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      const key = panel.dataset.panel;
      const collapsed = Boolean(state.collapsedPanels[key]);
      panel.classList.toggle("is-collapsed", collapsed);
      const toggle = panel.querySelector("[data-toggle-panel]");
      if (toggle) {
        toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
        const text = toggle.querySelector(".panel-chevron");
        if (text) {
          text.textContent = collapsed ? "Show" : "Hide";
        }
      }
    });
  }

  function loadState() {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) {
      return CONFIG.buildDemoData();
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.games)) {
        return CONFIG.buildDemoData();
      }
      return parsed;
    } catch (error) {
      console.error("Failed to parse saved state", error);
      return CONFIG.buildDemoData();
    }
  }

  function saveState() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.data));
  }

  function resetFilters() {
    state.filters = createDefaultFilters();
    state.view.mode = "global";
    state.view.gameId = null;
    state.view.groupKey = null;
    saveUiPrefs();
    render();
  }

  function syncFiltersFromForm() {
    state.filters.gameId = elements.filterGame.value;
    state.filters.type = elements.filterType.value;
    state.filters.state = elements.filterState.value;
    state.filters.expiringSoon = elements.filterExpiringSoon.checked;
    state.filters.disabledMode = elements.filterDisabledMode.value;
    state.filters.hideCompleted = elements.hideCompleted.checked;
    state.filters.hideExpired = elements.hideExpired.checked;
    state.filters.sortBy = elements.sortBy.value;
    saveUiPrefs();
    render();
  }

  function setView(mode, gameId, groupKey) {
    state.view.mode = mode;
    state.view.gameId = gameId || null;
    state.view.groupKey = groupKey || null;
    state.filters.gameId = mode === "focused" && gameId ? gameId : "all";
    saveUiPrefs();
    render();
  }

  function render() {
    syncResponsivePanels();
    const model = deriveModel();
    syncFilterControls(model.games);
    renderHero(model);
    renderContextActions(model);
    renderTaskList(model);
    renderGamesList(model.games);
    renderEditor();
  }

  function syncFilterControls(games) {
    elements.filterGame.innerHTML = ['<option value="all">All games</option>']
      .concat(games.map((game) => `<option value="${escapeHtml(game.id)}">${escapeHtml(game.name)}</option>`))
      .join("");

    elements.filterGame.value = games.some((game) => game.id === state.filters.gameId) || state.filters.gameId === "all"
      ? state.filters.gameId
      : "all";
    if (elements.filterGame.value !== state.filters.gameId) {
      state.filters.gameId = elements.filterGame.value;
    }

    elements.filterType.value = state.filters.type;
    elements.filterState.value = state.filters.state;
    elements.filterExpiringSoon.checked = state.filters.expiringSoon;
    elements.filterDisabledMode.value = state.filters.disabledMode;
    elements.hideCompleted.checked = state.filters.hideCompleted;
    elements.hideExpired.checked = state.filters.hideExpired;
    elements.sortBy.value = state.filters.sortBy;
  }

  function deriveModel() {
    const now = new Date();
    const games = state.data.games.map((game) => deriveGame(game, now));
    const scopeId = state.view.mode === "focused" ? state.view.gameId : null;
    const scopedGroupKey = state.view.groupKey;
    let tasks = games.flatMap((game) => game.tasks);

    if (scopeId) {
      tasks = tasks.filter((task) => task.gameId === scopeId);
    }
    if (scopedGroupKey) {
      tasks = tasks.filter((task) => task.groupKey === scopedGroupKey);
    }
    if (state.filters.gameId !== "all") {
      tasks = tasks.filter((task) => task.gameId === state.filters.gameId);
    }
    if (state.filters.type !== "all") {
      tasks = tasks.filter((task) => task.type === state.filters.type);
    }
    if (state.filters.state !== "all") {
      tasks = tasks.filter((task) => task.status === state.filters.state);
    }
    if (state.filters.expiringSoon) {
      tasks = tasks.filter((task) => task.expiringSoon);
    }
    if (state.filters.disabledMode === "hide") {
      tasks = tasks.filter((task) => !task.isDisabled);
    } else if (state.filters.disabledMode === "only") {
      tasks = tasks.filter((task) => task.isDisabled);
    }
    if (state.filters.hideCompleted) {
      tasks = tasks.filter((task) => task.status !== "completed");
    }
    if (state.filters.hideExpired) {
      tasks = tasks.filter((task) => !task.isExpired);
    }

    tasks = tasks.slice().sort((a, b) => compareTasks(a, b, state.filters.sortBy));

    const groupSections = [];
    const sectionMap = new Map();
    tasks.forEach((task) => {
      if (!sectionMap.has(task.groupKey)) {
        const group = games
          .flatMap((game) => game.groups)
          .find((item) => item.groupKey === task.groupKey);
        if (!group) {
          return;
        }
        const section = {
          ...group,
          tasks: [],
        };
        sectionMap.set(task.groupKey, section);
        groupSections.push(section);
      }
      sectionMap.get(task.groupKey).tasks.push(task);
    });

    groupSections.forEach((section) => {
      section.summary = summarizeTasks(section.tasks);
    });

    return {
      games,
      tasks,
      groupSections,
      stats: {
        total: tasks.length,
        available: tasks.filter((task) => task.status === "available").length,
        completed: tasks.filter((task) => task.status === "completed").length,
        expired: tasks.filter((task) => task.status === "expired").length,
      },
    };
  }

  function deriveGame(game, now) {
    const settings = normalizeResetSettings(game.resetSettings, null);
    const baseGame = {
      ...game,
      tasks: Array.isArray(game.tasks) ? game.tasks : [],
      groups: Array.isArray(game.groups) ? game.groups : [],
    };
    const groups = baseGame.groups.map((group) => deriveGroup(group, baseGame, settings, now));
    const directGroup = deriveVirtualGroup(baseGame, settings, now);
    if (directGroup) {
      groups.unshift(directGroup);
    }
    return {
      ...baseGame,
      effectiveResetSettings: settings,
      groups,
      tasks: groups.flatMap((group) => group.tasks),
      isExpired: isExpiredAt(game.expiresAt, now),
    };
  }

  function deriveGroup(group, game, parentResetSettings, now) {
    const isEventGroup = Boolean(group.isEventGroup);
    const settings = group.resetOverrideEnabled
      ? normalizeResetSettings(group.resetSettings, parentResetSettings)
      : parentResetSettings;

    return {
      ...group,
      isEventGroup,
      isDisabled: Boolean(group.isDisabled),
      groupKey: group.id,
      isVirtual: false,
      effectiveResetSettings: settings,
      gameId: game.id,
      gameName: game.name,
      tasks: group.tasks.map((task) => deriveTask(task, group, game, settings, now)),
      isExpired: isExpiredAt(isEventGroup ? group.expiresAt : null, now) || isExpiredAt(game.expiresAt, now),
    };
  }

  function deriveVirtualGroup(game, parentResetSettings, now) {
    const directTasks = Array.isArray(game.tasks) ? game.tasks : [];
    if (!directTasks.length) {
      return null;
    }

    const virtualGroup = {
      id: null,
      groupKey: `${game.id}::ungrouped`,
      name: "Ungrouped",
      notes: "Tasks attached directly to the game.",
      priority: game.priority || 3,
      expiresAt: game.expiresAt,
      resetOverrideEnabled: false,
      resetSettings: parentResetSettings,
      gameId: game.id,
      gameName: game.name,
      effectiveResetSettings: parentResetSettings,
      isExpired: isExpiredAt(game.expiresAt, now),
      isDisabled: false,
      isVirtual: true,
      tasks: directTasks.map((task) => deriveTask(task, null, game, parentResetSettings, now)),
    };
    return virtualGroup;
  }

  function deriveTask(task, group, game, parentResetSettings, now) {
    const settings = task.resetOverrideEnabled
      ? normalizeResetSettings(task.resetSettings, parentResetSettings)
      : parentResetSettings;
    const derivedType = group && group.isEventGroup
      ? "event"
      : task.type;
    const completedAt = task.completedAt ? new Date(task.completedAt) : null;
    const effectiveExpiresAt = group && group.isEventGroup
      ? group.expiresAt || null
      : task.expiresAt || (group && group.expiresAt) || game.expiresAt || null;
    const expirationDate = effectiveExpiresAt ? new Date(effectiveExpiresAt) : null;
    const isExpired = isExpiredAt(effectiveExpiresAt, now);

    let nextResetAt = null;
    let lastWindowStart = null;
    let status = "available";
    let canComplete = !isExpired;

    if (derivedType === "daily") {
      lastWindowStart = getDailyWindowStart(now, settings.dailyTime);
      nextResetAt = getNextDailyReset(now, settings.dailyTime);
      status = completedAt && completedAt >= lastWindowStart ? "completed" : "available";
    } else if (derivedType === "weekly") {
      lastWindowStart = getWeeklyWindowStart(now, settings.weeklyDay, settings.weeklyTime);
      nextResetAt = getNextWeeklyReset(now, settings.weeklyDay, settings.weeklyTime);
      status = completedAt && completedAt >= lastWindowStart ? "completed" : "available";
    } else {
      status = completedAt ? "completed" : "available";
      canComplete = !completedAt && !isExpired;
    }

    if (isExpired) {
      status = "expired";
      canComplete = false;
    }
    if (task.isDisabled || (group && group.isDisabled)) {
      canComplete = false;
    }

    const timing = deriveTaskTiming(derivedType, nextResetAt, expirationDate, now);

    return {
      ...task,
      type: derivedType,
      isDisabled: Boolean(task.isDisabled || (group && group.isDisabled)),
      gameId: game.id,
      gameName: game.name,
      groupId: group ? group.id : null,
      groupKey: group ? group.groupKey || group.id : `${game.id}::ungrouped`,
      groupName: group ? group.name : "Ungrouped",
      effectiveResetSettings: settings,
      completedAt,
      expirationDate,
      nextResetAt,
      lastWindowStart,
      status,
      isExpired,
      canComplete,
      expiringSoon: timing.isUrgent,
      timingLabel: timing.label,
      countdownText: timing.countdownText,
      nextRelevantAt: timing.nextRelevantAt,
      isUrgent: timing.isUrgent,
      urgencyKind: timing.kind,
      inheritedFrom: task.resetOverrideEnabled ? "task" : group && group.resetOverrideEnabled ? "group" : "game",
    };
  }

  function summarizeTasks(tasks) {
    const sortedRelevant = tasks
      .map((task) => task.nextRelevantAt)
      .filter(Boolean)
      .sort((a, b) => a.getTime() - b.getTime());
    return {
      total: tasks.length,
      available: tasks.filter((task) => task.status === "available").length,
      completed: tasks.filter((task) => task.status === "completed").length,
      expired: tasks.filter((task) => task.status === "expired").length,
      urgent: tasks.filter((task) => task.isUrgent).length,
      nextRelevantAt: sortedRelevant[0] || null,
    };
  }

  function deriveTaskTiming(type, nextResetAt, expirationDate, now) {
    if (type === "event") {
      return buildTimingInfo("event", expirationDate, now, true);
    }

    if (type === "daily") {
      return buildTimingInfo("reset", nextResetAt, now, false, CONFIG.urgencyWindowsHours.daily);
    }

    if (type === "weekly") {
      return buildTimingInfo("reset", nextResetAt, now, false, CONFIG.urgencyWindowsHours.weekly);
    }

    if (expirationDate) {
      return buildTimingInfo("expires", expirationDate, now, true);
    }

    return {
      kind: null,
      label: "",
      countdownText: "",
      nextRelevantAt: null,
      isUrgent: false,
    };
  }

  function buildTimingInfo(kind, date, now, alwaysShowCountdown, urgentWindowHours) {
    if (!date) {
      return {
        kind: null,
        label: "",
        countdownText: "",
        nextRelevantAt: null,
        isUrgent: false,
      };
    }

    const diffMs = date.getTime() - now.getTime();
    const isUrgent = diffMs > 0 && (alwaysShowCountdown || diffMs <= urgentWindowHours * 60 * 60 * 1000);
    return {
      kind,
      label: kind === "event" ? "Ends in" : kind === "expires" ? "Expires in" : "Resets in",
      countdownText: formatCountdown(diffMs),
      nextRelevantAt: date,
      isUrgent,
    };
  }

  function normalizeResetSettings(settings, fallback) {
    const safeFallback = fallback || createDefaultResetSettings();
    return {
      dailyTime: settings && settings.dailyTime ? settings.dailyTime : safeFallback.dailyTime,
      weeklyDay: settings && Number.isInteger(Number(settings.weeklyDay)) ? Number(settings.weeklyDay) : safeFallback.weeklyDay,
      weeklyTime: settings && settings.weeklyTime ? settings.weeklyTime : safeFallback.weeklyTime,
    };
  }

  function isExpiredAt(isoString, now) {
    if (!isoString) {
      return false;
    }
    return new Date(isoString).getTime() <= now.getTime();
  }

  function getDailyWindowStart(now, timeString) {
    const [hours, minutes] = parseTimeString(timeString);
    const start = new Date(now);
    start.setHours(hours, minutes, 0, 0);
    if (now.getTime() < start.getTime()) {
      start.setDate(start.getDate() - 1);
    }
    return start;
  }

  function getNextDailyReset(now, timeString) {
    const [hours, minutes] = parseTimeString(timeString);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  function getWeeklyWindowStart(now, targetDay, timeString) {
    const nextReset = getNextWeeklyReset(now, targetDay, timeString);
    const start = new Date(nextReset);
    start.setDate(start.getDate() - 7);
    return start;
  }

  function getNextWeeklyReset(now, targetDay, timeString) {
    const [hours, minutes] = parseTimeString(timeString);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    const dayDelta = (targetDay - now.getDay() + 7) % 7;
    next.setDate(now.getDate() + dayDelta);
    if (dayDelta === 0 && next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 7);
    }
    return next;
  }

  function parseTimeString(timeString) {
    const [hours, minutes] = (timeString || CONFIG.defaultResetSettings.dailyTime).split(":").map(Number);
    return [hours || 0, minutes || 0];
  }

  function compareTasks(a, b, sortBy) {
    if (sortBy === "time") {
      return compareOptionalDates(a.nextRelevantAt, b.nextRelevantAt) || compareByPriority(a, b) || compareByAvailability(a, b) || compareByName(a, b);
    }
    if (sortBy === "alphabetical") {
      return compareByName(a, b) || compareByPriority(a, b) || compareByAvailability(a, b);
    }
    if (sortBy === "priority") {
      return compareByPriority(a, b) || compareByAvailability(a, b) || compareOptionalDates(a.nextRelevantAt, b.nextRelevantAt) || compareByName(a, b);
    }
    return compareOptionalDates(a.nextRelevantAt, b.nextRelevantAt) || compareByPriority(a, b) || compareByAvailability(a, b) || compareByName(a, b);
  }

  function compareByPriority(a, b) {
    return (b.priority || 0) - (a.priority || 0);
  }

  function compareByAvailability(a, b) {
    const rank = { available: 0, completed: 1, expired: 2 };
    return rank[a.status] - rank[b.status];
  }

  function compareOptionalDates(a, b) {
    if (!a && !b) {
      return 0;
    }
    if (!a) {
      return 1;
    }
    if (!b) {
      return -1;
    }
    return a.getTime() - b.getTime();
  }

  function compareByName(a, b) {
    return a.name.localeCompare(b.name);
  }

  function hashString(value) {
    return Array.from(String(value || "")).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7);
  }

  function getGameAccent(gameKey) {
    const hue = hashString(gameKey) % 360;
    return {
      hue,
      strong: `hsl(${hue} 62% 44%)`,
      soft: `hsl(${hue} 72% 92%)`,
      darkSoft: `hsl(${hue} 34% 18%)`,
    };
  }

  function gameAccentStyle(gameKey) {
    const accent = getGameAccent(gameKey);
    const soft = state.theme === "dark" ? accent.darkSoft : accent.soft;
    return `--game-accent:${accent.strong};--game-accent-soft:${soft};`;
  }

  function applyHeroAccent(focusedGame) {
    if (!elements.hero) {
      return;
    }
    if (!focusedGame) {
      elements.hero.style.removeProperty("--game-accent");
      elements.hero.style.removeProperty("--game-accent-soft");
      elements.hero.classList.remove("accented-hero");
      return;
    }

    const accent = getGameAccent(focusedGame.id || focusedGame.name);
    const soft = state.theme === "dark" ? accent.darkSoft : accent.soft;
    elements.hero.style.setProperty("--game-accent", accent.strong);
    elements.hero.style.setProperty("--game-accent-soft", soft);
    elements.hero.classList.add("accented-hero");
  }

  function renderHero(model) {
    const focusedGame = state.view.mode === "focused"
      ? model.games.find((game) => game.id === state.view.gameId)
      : null;
    const focusedGroup = focusedGame && state.view.groupKey
      ? focusedGame.groups.find((group) => group.groupKey === state.view.groupKey)
      : null;

    elements.heroTitle.textContent = focusedGroup
      ? `${focusedGame.name} / ${focusedGroup.name}`
      : focusedGame ? focusedGame.name : "Global dashboard";
    elements.heroSubtitle.textContent = focusedGroup
      ? "Focused group view with group summaries, actions, and inherited reset settings."
      : focusedGame
      ? "Focused game view with the same reset-aware tracking rules."
      : "All games, groups, and tasks in one place.";
    elements.listTitle.textContent = focusedGroup ? `${focusedGroup.name} tasks` : focusedGame ? `${focusedGame.name} groups` : "Groups";
    applyHeroAccent(focusedGame);
    elements.heroStats.innerHTML = [
      statMarkup("Visible", model.stats.total),
      statMarkup("Available", model.stats.available),
      statMarkup("Done", model.stats.completed),
      statMarkup("Expired", model.stats.expired),
    ].join("");
  }

  function statMarkup(label, value) {
    return `<div class="stat-card"><span class="subtle">${label}</span><strong>${value}</strong></div>`;
  }

  function renderContextActions(model) {
    const focusedGame = state.view.mode === "focused"
      ? model.games.find((game) => game.id === state.view.gameId)
      : null;
    const focusedGroup = focusedGame && state.view.groupKey
      ? focusedGame.groups.find((group) => group.groupKey === state.view.groupKey)
      : null;
    const actions = [];

    if (focusedGame) {
      actions.push(`<button class="secondary-button" data-add="group" data-game-id="${escapeHtml(focusedGame.id)}" type="button">Add group</button>`);
      actions.push(`<button class="secondary-button" data-export-game="${escapeHtml(focusedGame.id)}" type="button">Export game</button>`);
      actions.push(`<button class="secondary-button" data-add="task" data-scope-game="${escapeHtml(focusedGame.id)}" data-scope-group="${escapeHtml(focusedGroup ? focusedGroup.groupKey : "")}" type="button">Add task</button>`);
    } else {
      actions.push(`<button class="secondary-button" data-add="task" type="button">Quick add task</button>`);
    }
    if (model.groupSections.length > 1) {
      actions.push('<button class="ghost-button" data-collapse-all="true" type="button">Collapse all</button>');
      actions.push('<button class="ghost-button" data-expand-all="true" type="button">Expand all</button>');
    }
    elements.contextActions.innerHTML = actions.join("");

    elements.contextActions.querySelectorAll("[data-add]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.add === "group") {
          openEditor({ mode: "create", entityType: "group", parentType: "game", parentId: button.dataset.gameId });
          return;
        }

        const defaultGameId = focusedGame ? focusedGame.id : (model.games[0] ? model.games[0].id : null);
        if (!defaultGameId) {
          openEditor({ mode: "create", entityType: "game", parentType: null, parentId: null });
          return;
        }
        openEditor({
          mode: "create",
          entityType: "task",
          parentType: "game",
          parentId: defaultGameId,
          groupKey: button.dataset.scopeGroup || null,
        });
      });
    });

    elements.contextActions.querySelectorAll("[data-export-game]").forEach((button) => {
      button.addEventListener("click", () => exportGameJson(button.dataset.exportGame));
    });
    elements.contextActions.querySelectorAll("[data-collapse-all]").forEach((button) => {
      button.addEventListener("click", () => collapseAllGroups(model.groupSections));
    });
    elements.contextActions.querySelectorAll("[data-expand-all]").forEach((button) => {
      button.addEventListener("click", expandAllGroups);
    });
  }

  function renderTaskList(model) {
    if (!model.groupSections.length) {
      elements.emptyState.hidden = false;
      elements.taskList.innerHTML = "";
      return;
    }

    elements.emptyState.hidden = true;
    elements.taskList.innerHTML = model.groupSections.map(renderGroupSection).join("");

    elements.taskList.querySelectorAll("[data-complete-id]").forEach((button) => {
      button.addEventListener("click", () => completeTask(button.dataset.completeId));
    });
    elements.taskList.querySelectorAll("[data-edit-task]").forEach((button) => {
      button.addEventListener("click", () => openEditor({ mode: "edit", entityType: "task", id: button.dataset.editTask }));
    });
    elements.taskList.querySelectorAll("[data-undo-id]").forEach((button) => {
      button.addEventListener("click", () => undoTask(button.dataset.undoId));
    });
    elements.taskList.querySelectorAll("[data-toggle-group]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.toggleGroup;
        state.collapsedGroups[key] = !state.collapsedGroups[key];
        saveUiPrefs();
        render();
      });
    });
    elements.taskList.querySelectorAll("[data-focus-group]").forEach((button) => {
      button.addEventListener("click", () => setView("focused", button.dataset.gameId, button.dataset.focusGroup));
    });
    elements.taskList.querySelectorAll("[data-clear-group-focus]").forEach((button) => {
      button.addEventListener("click", () => setView("focused", button.dataset.gameId, null));
    });
    elements.taskList.querySelectorAll("[data-group-complete]").forEach((button) => {
      button.addEventListener("click", () => completeGroupAvailableTasks(button.dataset.groupComplete));
    });
    elements.taskList.querySelectorAll("[data-group-export]").forEach((button) => {
      button.addEventListener("click", () => exportGroupJson(button.dataset.groupExport));
    });
    elements.taskList.querySelectorAll("[data-group-add-task]").forEach((button) => {
      button.addEventListener("click", () => openEditor({
        mode: "create",
        entityType: "task",
        parentType: "game",
        parentId: button.dataset.gameId,
        groupKey: button.dataset.groupAddTask,
      }));
    });
    elements.taskList.querySelectorAll("[data-edit-group]").forEach((button) => {
      button.addEventListener("click", () => openEditor({ mode: "edit", entityType: "group", id: button.dataset.editGroup }));
    });
    elements.taskList.querySelectorAll("[data-toggle-task-disabled]").forEach((button) => {
      button.addEventListener("click", () => toggleEntityDisabled("task", button.dataset.toggleTaskDisabled));
    });
    elements.taskList.querySelectorAll("[data-toggle-group-disabled]").forEach((button) => {
      button.addEventListener("click", () => toggleEntityDisabled("group", button.dataset.toggleGroupDisabled));
    });
  }

  function renderGroupSection(group) {
    const isCollapsed = Boolean(state.collapsedGroups[group.groupKey]);
    const resetLabel = group.isVirtual
      ? "Uses game reset"
      : group.resetOverrideEnabled
      ? `Custom reset · Daily ${group.effectiveResetSettings.dailyTime} · Weekly ${dayName(group.effectiveResetSettings.weeklyDay)} ${group.effectiveResetSettings.weeklyTime}`
      : "Uses game reset";

    return `
      <section class="group-section ${group.isExpired ? "expired" : ""}">
        <div class="group-header">
          <div class="group-title">
            <div class="group-title-row">
              <button class="ghost-button group-toggle" type="button" data-toggle-group="${escapeHtml(group.groupKey)}">${isCollapsed ? "Show" : "Hide"}</button>
              <h3>${escapeHtml(group.name)}</h3>
              <div class="badge-row">
                <span class="badge">${group.summary.available} open</span>
                <span class="badge">${group.summary.completed} done</span>
                ${group.summary.expired ? `<span class="badge expired">${group.summary.expired} expired</span>` : ""}
              </div>
            </div>
            <p class="subtle">${escapeHtml(group.gameName)} · ${escapeHtml(resetLabel)}${group.expiresAt ? ` · Expires ${escapeHtml(formatDateTime(group.expiresAt))}` : ""}</p>
            ${group.notes ? `<p class="subtle group-notes">${escapeHtml(group.notes)}</p>` : ""}
          </div>
          <div class="group-actions">
            <button class="task-action" type="button" data-focus-group="${escapeHtml(group.groupKey)}" data-game-id="${escapeHtml(group.gameId)}">Focus</button>
            ${state.view.groupKey === group.groupKey ? `<button class="task-action" type="button" data-clear-group-focus="true" data-game-id="${escapeHtml(group.gameId)}">Back</button>` : ""}
            <button class="task-action" type="button" data-group-add-task="${escapeHtml(group.groupKey)}" data-game-id="${escapeHtml(group.gameId)}">Add task</button>
            <button class="task-action" type="button" data-group-complete="${escapeHtml(group.groupKey)}">Complete open</button>
            <button class="task-action" type="button" data-group-export="${escapeHtml(group.groupKey)}">Export</button>
            ${group.isVirtual ? "" : `<button class="task-action" type="button" data-edit-group="${escapeHtml(group.id)}">Edit group</button>`}
          </div>
        </div>
        ${isCollapsed ? "" : `<div class="group-task-list">${group.tasks.map(renderTaskCard).join("")}</div>`}
      </section>
    `;
  }

  function renderTaskCard(task) {
    const badges = [
      `<span class="badge ${escapeHtml(task.status)}">${escapeHtml(capitalize(task.status))}</span>`,
      `<span class="badge">${escapeHtml(task.type)}</span>`,
      `<span class="badge">P${escapeHtml(String(task.priority || 3))}</span>`,
    ];
    if (task.expiringSoon) {
      badges.push('<span class="badge soon">Soon</span>');
    }

    return `
      <article class="task-card ${escapeHtml(task.status)}">
        <div class="task-row">
          <div class="task-main">
            <div class="task-head">
              <div class="task-title-block">
                <h3>${escapeHtml(task.name)}</h3>
                <p class="subtle">${escapeHtml(task.gameName)} / ${escapeHtml(task.groupName)}</p>
              </div>
              <div class="badge-row">${badges.join("")}</div>
            </div>
            <div class="task-meta">
              <div class="subtle">${escapeHtml(formatTiming(task))}</div>
              <div class="subtle">Reset: ${escapeHtml(task.inheritedFrom)}${task.nextResetAt ? ` · ${escapeHtml(formatDateTime(task.nextResetAt))}` : ""}${task.expirationDate ? ` · Expires ${escapeHtml(formatDateTime(task.expirationDate))}` : ""}</div>
              ${task.notes ? `<div class="task-notes subtle">${escapeHtml(task.notes)}</div>` : ""}
            </div>
          </div>
          <div class="task-actions">
            <button class="task-action ${task.canComplete ? "complete" : ""}" type="button" data-complete-id="${escapeHtml(task.id)}" ${task.canComplete ? "" : "disabled"}>
              ${task.status === "completed" && (task.type === "daily" || task.type === "weekly") ? "Done" : task.completedAt ? "Done" : "Complete"}
            </button>
            <button class="task-action" type="button" data-edit-task="${escapeHtml(task.id)}">Edit</button>
          </div>
        </div>
      </article>
    `;
  }

  function formatTiming(task) {
    if (task.isExpired) {
      return `Expired ${formatDateTime(task.expirationDate || new Date())}`;
    }
    if (task.status === "completed" && task.completedAt) {
      return `Completed ${formatDateTime(task.completedAt)}`;
    }
    if (task.type === "one-time" || task.type === "event") {
      return task.expirationDate ? `Expires ${formatDateTime(task.expirationDate)}` : "No automatic reset";
    }
    return task.nextResetAt ? `Available until ${formatDateTime(task.nextResetAt)}` : "Reset schedule unavailable";
  }

  function renderTaskCountdown(task) {
    if (!task.countdownText || !task.timingLabel) {
      return "";
    }

    return `<div class="countdown-pill ${task.isUrgent ? "urgent" : ""}">${escapeHtml(task.timingLabel)} <strong>${escapeHtml(task.countdownText)}</strong></div>`;
  }

  function renderGroupCountdown(summary, tasks) {
    const priorityTask = tasks
      .filter((task) => task.countdownText && task.status !== "completed" && task.status !== "expired")
      .sort((a, b) => {
        if (a.isUrgent !== b.isUrgent) {
          return a.isUrgent ? -1 : 1;
        }
        return compareOptionalDates(a.nextRelevantAt, b.nextRelevantAt);
      })[0];

    if (!priorityTask) {
      return "";
    }

    const label = priorityTask.timingLabel || "Next";
    return `<div class="countdown-pill group-countdown ${priorityTask.isUrgent ? "urgent" : ""}">${escapeHtml(label)} <strong>${escapeHtml(priorityTask.countdownText)}</strong></div>`;
  }

  function renderGamesList(games) {
    elements.gamesList.innerHTML = games.map((game) => `
      <article class="game-card">
        <div class="entity-row">
          <div>
            <h3>${escapeHtml(game.name)}</h3>
            <p class="subtle">${game.groups.length} groups · ${game.tasks.length} tasks</p>
          </div>
          <div class="badge-row">
            <button class="entity-link ${state.view.mode === "focused" && state.view.gameId === game.id ? "active" : ""}" type="button" data-focus-game="${escapeHtml(game.id)}">Focus</button>
            <button class="entity-link" type="button" data-export-game="${escapeHtml(game.id)}">Export</button>
            <button class="entity-link" type="button" data-edit-game="${escapeHtml(game.id)}">Edit</button>
          </div>
        </div>
        <div class="subtle">Daily ${escapeHtml(game.effectiveResetSettings.dailyTime)} · Weekly ${dayName(game.effectiveResetSettings.weeklyDay)} ${escapeHtml(game.effectiveResetSettings.weeklyTime)}</div>
        <div class="badge-row" style="margin-top: 12px;">
          ${game.groups.map((group) => `<button class="entity-link" type="button" data-edit-group="${escapeHtml(group.id)}">${escapeHtml(group.name)}</button>`).join("")}
        </div>
      </article>
    `).join("");

    elements.gamesList.querySelectorAll("[data-focus-game]").forEach((button) => {
      button.addEventListener("click", () => setView("focused", button.dataset.focusGame));
    });
    elements.gamesList.querySelectorAll("[data-edit-game]").forEach((button) => {
      button.addEventListener("click", () => openEditor({ mode: "edit", entityType: "game", id: button.dataset.editGame }));
    });
    elements.gamesList.querySelectorAll("[data-export-game]").forEach((button) => {
      button.addEventListener("click", () => exportGameJson(button.dataset.exportGame));
    });
    elements.gamesList.querySelectorAll("[data-edit-group]").forEach((button) => {
      button.addEventListener("click", () => openEditor({ mode: "edit", entityType: "group", id: button.dataset.editGroup }));
    });
  }

  function renderGroupSection(group) {
    const isCollapsed = Boolean(state.collapsedGroups[group.groupKey]);
    const resetLabel = group.isVirtual
      ? "Uses game reset"
      : group.isEventGroup
      ? "Event group"
      : group.resetOverrideEnabled
      ? `Custom reset / Daily ${group.effectiveResetSettings.dailyTime} / Weekly ${dayName(group.effectiveResetSettings.weeklyDay)} ${group.effectiveResetSettings.weeklyTime}`
      : "Uses game reset";
    const groupCountdown = renderGroupCountdown(group.summary, group.tasks);
    const eventCount = group.isEventGroup ? group.tasks.length : group.tasks.filter((task) => task.type === "event").length;
    const eventLabel = group.isEventGroup
      ? '<span class="badge event-badge">Event Group</span>'
      : eventCount > 0
      ? `<span class="badge event-badge">${eventCount} event${eventCount === 1 ? "" : "s"}</span>`
      : "";

    return `
      <section class="group-section ${group.isExpired ? "expired" : ""} ${group.isEventGroup || eventCount ? "has-events" : ""} ${group.isDisabled ? "disabled-item" : ""}" style="${gameAccentStyle(group.gameId || group.gameName)}">
        <div class="group-header">
          <div class="group-title">
            <div class="group-title-row">
              <button class="ghost-button group-toggle" type="button" data-toggle-group="${escapeHtml(group.groupKey)}">${isCollapsed ? "Show" : "Hide"}</button>
              <h3>${escapeHtml(group.name)}</h3>
              <div class="badge-row">
                ${eventLabel}
                ${group.isDisabled ? '<span class="badge">Disabled</span>' : ""}
                <span class="badge">${group.summary.available} open</span>
                <span class="badge">${group.summary.completed} done</span>
                ${group.summary.urgent ? `<span class="badge soon">${group.summary.urgent} urgent</span>` : ""}
                ${group.summary.expired ? `<span class="badge expired">${group.summary.expired} expired</span>` : ""}
              </div>
            </div>
            <p class="subtle">${escapeHtml(group.gameName)} / ${escapeHtml(resetLabel)}${group.isEventGroup && group.expiresAt ? ` / Expires ${escapeHtml(formatDateTime(group.expiresAt))}` : ""}</p>
            ${group.notes ? `<p class="subtle group-notes">${escapeHtml(group.notes)}</p>` : ""}
            ${groupCountdown}
          </div>
          <div class="group-actions">
            <button class="task-action" type="button" data-focus-group="${escapeHtml(group.groupKey)}" data-game-id="${escapeHtml(group.gameId)}">Focus</button>
            ${state.view.groupKey === group.groupKey ? `<button class="task-action" type="button" data-clear-group-focus="true" data-game-id="${escapeHtml(group.gameId)}">Back</button>` : ""}
            <button class="task-action" type="button" data-group-add-task="${escapeHtml(group.groupKey)}" data-game-id="${escapeHtml(group.gameId)}">Add task</button>
            <button class="task-action" type="button" data-group-complete="${escapeHtml(group.groupKey)}">Complete open</button>
            ${group.isVirtual ? "" : `<button class="task-action" type="button" data-toggle-group-disabled="${escapeHtml(group.id)}">${group.isDisabled ? "Enable" : "Disable"}</button>`}
            <button class="task-action" type="button" data-group-export="${escapeHtml(group.groupKey)}">Export</button>
            ${group.isVirtual ? "" : `<button class="task-action" type="button" data-edit-group="${escapeHtml(group.id)}">Edit group</button>`}
          </div>
        </div>
        ${isCollapsed ? "" : `<div class="group-task-list">${group.tasks.map(renderTaskCard).join("")}</div>`}
      </section>
    `;
  }

  function renderTaskCard(task) {
    const badges = [
      `<span class="badge ${escapeHtml(task.status)}">${escapeHtml(capitalize(task.status))}</span>`,
      `<span class="badge ${task.type === "event" ? "event-badge" : ""}">${escapeHtml(task.type === "event" ? "Event" : task.type)}</span>`,
      `<span class="badge">P${escapeHtml(String(task.priority || 3))}</span>`,
    ];
    if (task.isDisabled) {
      badges.push('<span class="badge">Disabled</span>');
    }
    if (task.expiringSoon) {
      badges.push('<span class="badge soon">Soon</span>');
    }

    return `
      <article class="task-card ${escapeHtml(task.status)} ${task.type === "event" ? "event-task" : ""} ${task.isDisabled ? "disabled-item" : ""}" style="${gameAccentStyle(task.gameId || task.gameName)}">
        <div class="task-row">
          <div class="task-main">
            <div class="task-head">
              <div class="task-title-block">
                <h3>${escapeHtml(task.name)}</h3>
                <p class="subtle">${escapeHtml(task.gameName)} / ${escapeHtml(task.groupName)}</p>
              </div>
              <div class="badge-row">${badges.join("")}</div>
            </div>
            <div class="task-meta">
              <div class="subtle">${escapeHtml(formatTiming(task))}</div>
              <div class="subtle">${task.type === "event"
                ? `Event${task.expirationDate ? ` / Expires ${escapeHtml(formatDateTime(task.expirationDate))}` : ""}`
                : `Reset: ${escapeHtml(task.inheritedFrom)}${task.nextResetAt ? ` / ${escapeHtml(formatDateTime(task.nextResetAt))}` : ""}${task.expirationDate ? ` / Expires ${escapeHtml(formatDateTime(task.expirationDate))}` : ""}`}</div>
              ${renderTaskCountdown(task)}
              ${task.notes ? `<div class="task-notes subtle">${escapeHtml(task.notes)}</div>` : ""}
            </div>
          </div>
          <div class="task-actions">
            ${task.status === "completed"
              ? `<button class="task-action" type="button" data-undo-id="${escapeHtml(task.id)}">Undo</button>`
              : `<button class="task-action ${task.canComplete ? "complete" : ""}" type="button" data-complete-id="${escapeHtml(task.id)}" ${task.canComplete ? "" : "disabled"}>Complete</button>`}
            <button class="task-action" type="button" data-toggle-task-disabled="${escapeHtml(task.id)}">${task.isDisabled ? "Enable" : "Disable"}</button>
            <button class="task-action" type="button" data-edit-task="${escapeHtml(task.id)}">Edit</button>
          </div>
        </div>
      </article>
    `;
  }

  function revealEditor() {
    elements.editorPanel.classList.add("is-active");
    window.setTimeout(() => {
      elements.editorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstField = elements.editorHost.querySelector("input[type=\"text\"], select, textarea");
      if (firstField) {
        firstField.focus({ preventScroll: true });
      }
    }, 0);
  }

  function syncResetFieldState(form, resetFieldsSection, isGame) {
    const enabled = isGame || form.elements.resetEnabled.checked;
    resetFieldsSection.classList.toggle("is-disabled", !enabled);
    ["dailyTime", "weeklyDay", "weeklyTime"].forEach((name) => {
      form.elements[name].disabled = !enabled;
    });
  }

  function openEditor(config) {
    state.editor = config;
    renderEditor();
    revealEditor();
  }

  function closeEditor() {
    state.editor = null;
    renderEditor();
  }

  function handleDeleteEntity() {
    if (!state.editor || state.editor.mode !== "edit") {
      return;
    }
    const label = getEntityDisplayName(state.editor.entityType, state.editor.id);
    openConfirmation({
      title: `Delete ${state.editor.entityType}`,
      message: `Delete ${label}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        deleteEntity(state.editor.entityType, state.editor.id);
        saveState();
        closeEditor();
        render();
      },
    });
  }

  function completeTask(taskId) {
    const found = findEntityById("task", taskId);
    if (!found) {
      return;
    }

    if (found.entity.completedAt && (found.entity.type === "one-time" || found.entity.type === "event")) {
      return;
    }

    found.entity.completedAt = new Date().toISOString();
    saveState();
    render();
  }

  function findTaskParent(groupId) {
    for (const game of state.data.games) {
      const group = game.groups.find((item) => item.id === groupId);
      if (group) {
        return group;
      }
    }
    return null;
  }

  function findEntityById(entityType, id) {
    if (entityType === "game") {
      const game = state.data.games.find((item) => item.id === id);
      return game ? { entity: game } : null;
    }

    for (const game of state.data.games) {
      for (const group of game.groups) {
        if (entityType === "group" && group.id === id) {
          return { entity: group, parent: game };
        }
        for (const task of group.tasks) {
          if (entityType === "task" && task.id === id) {
            return { entity: task, parent: group, grandparent: game };
          }
        }
      }
    }

    return null;
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = CONFIG.exportConfig.trackerFilename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportGameJson(gameId) {
    const game = state.data.games.find((item) => item.id === gameId);
    if (!game) {
      return;
    }

    const fileName = `${slugify(game.name || "game")}.json`;
    downloadJson(game, fileName);
  }

  function downloadJson(data, fileName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importJson(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        const importedGames = extractImportedGames(parsed);
        if (!importedGames.length) {
          throw new Error("Invalid tracker data");
        }
        const importMode = elements.importMode.value || "merge";
        let importedCount = 0;

        if (importMode === "replace") {
          openConfirmation({
            title: "Replace tracker",
            message: CONFIG.importConfig.replaceConfirmMessage,
            confirmLabel: "Replace tracker",
            danger: true,
            onConfirm: () => {
              const importedIds = new Set();
              state.data = {
                games: importedGames.map((game) => prepareImportedGame(game, importedIds)),
              };
              importedCount = state.data.games.length;
              saveState();
              render();
              window.alert(`${CONFIG.importConfig.replaceSuccessPrefix} ${importedCount} game${importedCount === 1 ? "" : "s"}.`);
            },
          });
          return;
        } else {
          importedCount = mergeImportedGames(importedGames);
        }

        saveState();
        render();
        window.alert(`${importMode === "replace" ? CONFIG.importConfig.replaceSuccessPrefix : CONFIG.importConfig.mergeSuccessPrefix} ${importedCount} game${importedCount === 1 ? "" : "s"}.`);
      } catch (error) {
        window.alert(CONFIG.importConfig.invalidFileMessage);
      } finally {
        elements.importInput.value = "";
      }
    };
    reader.readAsText(file);
  }

  function extractImportedGames(parsed) {
    if (!parsed || typeof parsed !== "object") {
      return [];
    }
    if (Array.isArray(parsed.games)) {
      return parsed.games;
    }
    if (typeof parsed.name === "string" && parsed.resetSettings && !Array.isArray(parsed)) {
      return [parsed];
    }
    return [];
  }

  function mergeImportedGames(importedGames) {
    const existingIds = collectExistingIds(state.data);
    const preparedGames = importedGames.map((game) => prepareImportedGame(game, existingIds));
    state.data.games.push(...preparedGames);
    return preparedGames.length;
  }

  function prepareImportedGame(game, existingIds) {
    const clone = JSON.parse(JSON.stringify(game));
    clone.groups = Array.isArray(clone.groups) ? clone.groups : [];
    clone.id = ensureUniqueId(clone.id || "game-import", existingIds);
    existingIds.add(clone.id);

    clone.groups = clone.groups.map((group) => {
      const preparedGroup = {
        ...group,
        tasks: Array.isArray(group.tasks) ? group.tasks : [],
      };
      preparedGroup.id = ensureUniqueId(preparedGroup.id || `${clone.id}-group`, existingIds);
      existingIds.add(preparedGroup.id);
      preparedGroup.tasks = preparedGroup.tasks.map((task) => {
        const preparedTask = { ...task };
        preparedTask.id = ensureUniqueId(preparedTask.id || `${preparedGroup.id}-task`, existingIds);
        existingIds.add(preparedTask.id);
        return preparedTask;
      });
      return preparedGroup;
    });

    return clone;
  }

  function collectExistingIds(data) {
    const ids = new Set();
    data.games.forEach((game) => {
      ids.add(game.id);
      (game.groups || []).forEach((group) => {
        ids.add(group.id);
        (group.tasks || []).forEach((task) => {
          ids.add(task.id);
        });
      });
    });
    return ids;
  }

  function ensureUniqueId(baseId, usedIds) {
    let candidate = String(baseId);
    if (!usedIds.has(candidate)) {
      return candidate;
    }

    let index = 2;
    while (usedIds.has(`${candidate}-${index}`)) {
      index += 1;
    }
    return `${candidate}-${index}`;
  }

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "game";
  }

  function renderGamesList(games) {
    const sortedGames = [...games].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
    const globalCard = `
      <article class="game-card global-games-card">
        <div class="entity-row">
          <div class="game-card-main">
            <h3>All games</h3>
            <p class="subtle game-card-summary">Full tracker view</p>
          </div>
          <div class="badge-row game-card-actions">
            <button class="entity-link ${state.view.mode === "global" ? "active" : ""}" type="button" data-show-global="true">Show all</button>
          </div>
        </div>
      </article>
    `;

    elements.gamesList.innerHTML = globalCard + sortedGames.map((game) => {
      const realGroups = game.groups.filter((group) => !group.isVirtual);
      const isExpanded = Boolean(state.expandedGameGroups[game.id]);

      return `
        <article class="game-card" style="${gameAccentStyle(game.id || game.name)}">
          <div class="entity-row">
            <div class="game-card-main">
              <h3>${escapeHtml(game.name)}</h3>
              <p class="subtle game-card-summary">${realGroups.length} groups · ${game.tasks.length} direct tasks · Daily ${escapeHtml(game.effectiveResetSettings.dailyTime)} · Weekly ${dayName(game.effectiveResetSettings.weeklyDay)} ${escapeHtml(game.effectiveResetSettings.weeklyTime)}</p>
            </div>
            <div class="badge-row game-card-actions">
              <button class="entity-link ${state.view.mode === "focused" && state.view.gameId === game.id ? "active" : ""}" type="button" data-focus-game="${escapeHtml(game.id)}">Focus</button>
              <button class="entity-link" type="button" data-export-game="${escapeHtml(game.id)}">Export</button>
              <button class="entity-link" type="button" data-edit-game="${escapeHtml(game.id)}">Edit</button>
            </div>
          </div>
          ${realGroups.length
            ? `<div class="game-links-meta">
                <button class="ghost-button game-groups-toggle" type="button" data-toggle-game-groups="${escapeHtml(game.id)}" aria-expanded="${isExpanded ? "true" : "false"}">
                  ${isExpanded ? "Hide groups" : `Show groups (${realGroups.length})`}
                </button>
              </div>
              ${isExpanded
                ? `<div class="game-links-row">
                    ${realGroups.map((group) => `<button class="entity-link game-group-link ${state.view.groupKey === group.groupKey ? "active" : ""}" type="button" data-focus-group-card="${escapeHtml(group.groupKey)}" data-game-id="${escapeHtml(game.id)}">${escapeHtml(group.name)}</button>`).join("")}
                  </div>`
                : ""}`
            : ""}
        </article>
      `;
    }).join("");

    elements.gamesList.querySelectorAll("[data-show-global]").forEach((button) => {
      button.addEventListener("click", () => setView("global", null, null));
    });
    elements.gamesList.querySelectorAll("[data-focus-game]").forEach((button) => {
      button.addEventListener("click", () => setView("focused", button.dataset.focusGame));
    });
    elements.gamesList.querySelectorAll("[data-edit-game]").forEach((button) => {
      button.addEventListener("click", () => openEditor({ mode: "edit", entityType: "game", id: button.dataset.editGame }));
    });
    elements.gamesList.querySelectorAll("[data-export-game]").forEach((button) => {
      button.addEventListener("click", () => exportGameJson(button.dataset.exportGame));
    });
    elements.gamesList.querySelectorAll("[data-toggle-game-groups]").forEach((button) => {
      button.addEventListener("click", () => {
        const gameId = button.dataset.toggleGameGroups;
        state.expandedGameGroups[gameId] = !state.expandedGameGroups[gameId];
        saveUiPrefs();
        renderGamesList(games);
      });
    });
    elements.gamesList.querySelectorAll("[data-focus-group-card]").forEach((button) => {
      button.addEventListener("click", () => setView("focused", button.dataset.gameId, button.dataset.focusGroupCard));
    });
  }
  function renderEditor() {
    if (!state.editor) {
      elements.editorHost.innerHTML = "";
      elements.editorPanel.hidden = true;
      elements.editorPanel.classList.remove("is-active");
      return;
    }

    elements.editorPanel.hidden = false;

    const template = elements.editorTemplate.content.cloneNode(true);
    const form = template.getElementById("entityForm");
    const entity = getEditorEntity();
    const isGame = state.editor.entityType === "game";
    const isGroup = state.editor.entityType === "group";
    const isTask = state.editor.entityType === "task";
    const parentSection = template.querySelector('[data-role="parent-fields"]');
    const groupFieldsSection = template.querySelector('[data-role="group-fields"]');
    const taskFieldsSection = template.querySelector('[data-role="task-fields"]');
    const expirationFieldsSection = template.querySelector('[data-role="expiration-fields"]');
    const targetGameSelect = form.elements.targetGameId;
    const targetGroupSelect = form.elements.targetGroupId;
    const availableGames = getAvailableGamesForEditor();
    const resetFieldsSection = template.querySelector('[data-role="reset-fields"]');

    form.elements.id.value = entity.id || "";
    form.elements.entityType.value = state.editor.entityType;
    form.elements.parentType.value = entity.parentType || "";
    form.elements.parentId.value = entity.parentId || "";
    form.elements.name.value = entity.name || "";
    form.elements.notes.value = entity.notes || "";
    form.elements.priority.value = String(entity.priority || 3);
    form.elements.taskType.value = entity.type || "daily";
    form.elements.isEventGroup.checked = Boolean(entity.isEventGroup);
    form.elements.resetEnabled.checked = Boolean(entity.resetOverrideEnabled || isGame);
    form.elements.dailyTime.value = entity.resetSettings ? entity.resetSettings.dailyTime || "" : "";
    form.elements.weeklyDay.value = String(entity.resetSettings && Number.isInteger(Number(entity.resetSettings.weeklyDay)) ? Number(entity.resetSettings.weeklyDay) : 1);
    form.elements.weeklyTime.value = entity.resetSettings ? entity.resetSettings.weeklyTime || "" : "";
    form.elements.expiresAt.value = entity.expiresAt ? toDateTimeLocalValue(entity.expiresAt) : "";

    targetGameSelect.innerHTML = availableGames.length
      ? availableGames.map((game) => `<option value="${escapeHtml(game.id)}">${escapeHtml(game.name)}</option>`).join("")
      : '<option value="">No games yet</option>';
    targetGameSelect.value = entity.targetGameId || entity.parentId || (availableGames[0] ? availableGames[0].id : "");
    syncGroupOptions(form, entity.targetGroupId || "", entity.groupKey || null);

    parentSection.hidden = !isTask;
    groupFieldsSection.hidden = !isGroup;
    if (isGame) {
      form.elements.resetEnabled.closest("label").hidden = true;
    }
    if (state.editor.mode === "create") {
      template.querySelector('[data-action="delete"]').hidden = true;
    }
    if (isTask && !availableGames.length) {
      form.querySelector('button[type="submit"]').disabled = true;
    }

    targetGameSelect.addEventListener("change", () => {
      syncGroupOptions(form, "", null);
      syncEditorFormSections(form, {
        isGame,
        isGroup,
        isTask,
        taskFieldsSection,
        groupFieldsSection,
        resetFieldsSection,
        expirationFieldsSection,
      });
    });
    targetGroupSelect.addEventListener("change", () => syncEditorFormSections(form, {
      isGame,
      isGroup,
      isTask,
      taskFieldsSection,
      groupFieldsSection,
      resetFieldsSection,
      expirationFieldsSection,
    }));
    form.elements.isEventGroup.addEventListener("change", () => syncEditorFormSections(form, {
      isGame,
      isGroup,
      isTask,
      taskFieldsSection,
      groupFieldsSection,
      resetFieldsSection,
      expirationFieldsSection,
    }));
    form.elements.taskType.addEventListener("change", () => syncEditorFormSections(form, {
      isGame,
      isGroup,
      isTask,
      taskFieldsSection,
      groupFieldsSection,
      resetFieldsSection,
      expirationFieldsSection,
    }));
    if (!isGame) {
      form.elements.resetEnabled.addEventListener("change", () => syncResetFieldState(form, resetFieldsSection, isGame));
    }
    syncEditorFormSections(form, {
      isGame,
      isGroup,
      isTask,
      taskFieldsSection,
      groupFieldsSection,
      resetFieldsSection,
      expirationFieldsSection,
    });

    form.addEventListener("submit", handleEditorSubmit);
    template.querySelector('[data-action="cancel"]').addEventListener("click", closeEditor);
    template.querySelector('[data-action="delete"]').addEventListener("click", handleDeleteEntity);

    elements.editorHost.innerHTML = "";
    elements.editorHost.appendChild(template);
  }

  function syncGroupOptions(form, selectedGroupId, preferredGroupKey) {
    const gameId = form.elements.targetGameId.value;
    const groups = getAvailableGroupsForGame(gameId);
    const options = ['<option value="">No group (attach directly to game)</option>']
      .concat(groups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`))
      .join("");
    form.elements.targetGroupId.innerHTML = options;

    const preferred = preferredGroupKey
      ? groups.find((group) => group.groupKey === preferredGroupKey)
      : null;
    form.elements.targetGroupId.value = selectedGroupId || (preferred ? preferred.id : "");
  }

  function syncEditorFormSections(form, sections) {
    const selectedGroup = form.elements.targetGroupId
      ? getAvailableGroupsForGame(form.elements.targetGameId.value).find((group) => group.id === form.elements.targetGroupId.value)
      : null;
    const taskInEventGroup = sections.isTask && selectedGroup && selectedGroup.isEventGroup;
    const groupIsEvent = sections.isGroup && form.elements.isEventGroup.checked;
    const taskIsEvent = sections.isTask && form.elements.taskType.value === "event";

    sections.taskFieldsSection.hidden = !sections.isTask || Boolean(taskInEventGroup);
    sections.groupFieldsSection.hidden = !sections.isGroup;
    sections.expirationFieldsSection.hidden = !(groupIsEvent || taskIsEvent);
    sections.resetFieldsSection.hidden = groupIsEvent;

    syncResetFieldState(form, sections.resetFieldsSection, sections.isGame || groupIsEvent);
  }

  function getEditorEntity() {
    if (!state.editor) {
      return {};
    }

    if (state.editor.mode === "create") {
      return {
        parentType: state.editor.parentType,
        parentId: state.editor.parentId,
        targetGameId: state.editor.parentId,
        targetGroupId: resolveGroupIdFromKey(state.editor.groupKey),
        groupKey: state.editor.groupKey || null,
        priority: 3,
        type: "daily",
        isEventGroup: false,
        resetOverrideEnabled: state.editor.entityType === "game",
        resetSettings: createDefaultResetSettings(),
      };
    }

    const found = findEntityById(state.editor.entityType, state.editor.id);
    if (!found) {
      return {};
    }
    if (state.editor.entityType === "task") {
      return {
        ...found.entity,
        parentType: found.parentType,
        parentId: found.parent ? found.parent.id : found.game.id,
        targetGameId: found.game.id,
        targetGroupId: found.parentType === "group" ? found.parent.id : "",
        groupKey: found.parentType === "group" ? found.parent.id : `${found.game.id}::ungrouped`,
      };
    }
    return found.entity;
  }

  function handleEditorSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const entityType = String(formData.get("entityType"));
    const isEventGroup = entityType === "group" && formData.get("isEventGroup") === "on";
    const isEventTask = entityType === "task" && formData.get("taskType") === "event";
    const resetOverrideEnabled = entityType === "game" ? true : isEventGroup ? false : formData.get("resetEnabled") === "on";
    const existing = formData.get("id") ? findEntityById(entityType, String(formData.get("id"))) : null;
    const expiresAt = ((entityType === "group" && isEventGroup) || (entityType === "task" && isEventTask)) && formData.get("expiresAt")
      ? new Date(String(formData.get("expiresAt"))).toISOString()
      : null;

    const payload = {
      id: String(formData.get("id") || crypto.randomUUID()),
      name: String(formData.get("name") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
      priority: Number(formData.get("priority") || 3),
      expiresAt,
      resetOverrideEnabled,
      resetSettings: {
        dailyTime: String(formData.get("dailyTime") || "") || null,
        weeklyDay: Number(formData.get("weeklyDay") || 1),
        weeklyTime: String(formData.get("weeklyTime") || "") || null,
      },
    };

    if (entityType === "group") {
      payload.isEventGroup = isEventGroup;
    }

    if (!payload.name) {
      return;
    }

    if (entityType === "task") {
      payload.type = String(formData.get("taskType") || "daily");
      payload.completedAt = existing && existing.entity.completedAt ? existing.entity.completedAt : null;
      payload.targetGameId = String(formData.get("targetGameId") || "");
      payload.targetGroupId = String(formData.get("targetGroupId") || "");
    }

    if (state.editor.mode === "create") {
      createEntity(entityType, payload, {
        parentType: entityType === "task" ? (payload.targetGroupId ? "group" : "game") : String(formData.get("parentType") || ""),
        parentId: entityType === "task" ? (payload.targetGroupId || payload.targetGameId) : String(formData.get("parentId") || ""),
      });
    } else {
      updateEntity(entityType, payload);
      if (entityType === "task") {
        moveTaskToContainer(payload.id, payload.targetGameId, payload.targetGroupId);
      }
    }

    saveState();
    closeEditor();
    render();
  }

  function createEntity(entityType, payload, parentRef) {
    if (entityType === "game") {
      state.data.games.push({
        id: payload.id,
        name: payload.name,
        notes: payload.notes,
        priority: payload.priority,
        expiresAt: payload.expiresAt,
        resetSettings: payload.resetSettings,
        groups: [],
        tasks: [],
      });
      return;
    }

    if (entityType === "group") {
      const game = state.data.games.find((item) => item.id === parentRef.parentId);
      if (!game) {
        return;
      }
      game.groups = Array.isArray(game.groups) ? game.groups : [];
      game.groups.push({
        id: payload.id,
        name: payload.name,
        notes: payload.notes,
        priority: payload.priority,
        isDisabled: false,
        isEventGroup: Boolean(payload.isEventGroup),
        expiresAt: payload.expiresAt,
        resetOverrideEnabled: payload.resetOverrideEnabled,
        resetSettings: payload.resetSettings,
        tasks: [],
      });
      return;
    }

    const taskRecord = {
      id: payload.id,
      name: payload.name,
      notes: payload.notes,
      priority: payload.priority,
      type: payload.type,
      isDisabled: false,
      completedAt: payload.completedAt,
      expiresAt: payload.expiresAt,
      resetOverrideEnabled: payload.resetOverrideEnabled,
      resetSettings: payload.resetSettings,
    };

    if (parentRef.parentType === "group") {
      const group = findTaskParent(parentRef.parentId);
      if (!group) {
        return;
      }
      group.tasks.push(taskRecord);
      return;
    }

    const game = state.data.games.find((item) => item.id === parentRef.parentId);
    if (!game) {
      return;
    }
    game.tasks = Array.isArray(game.tasks) ? game.tasks : [];
    game.tasks.push(taskRecord);
  }

  function updateEntity(entityType, payload) {
    const found = findEntityById(entityType, payload.id);
    if (!found) {
      return;
    }

    const nextValue = { ...payload };
    delete nextValue.targetGameId;
    delete nextValue.targetGroupId;
    Object.assign(found.entity, nextValue);
  }

  function moveTaskToContainer(taskId, targetGameId, targetGroupId) {
    const found = findEntityById("task", taskId);
    if (!found) {
      return;
    }

    const destination = getTaskContainer(targetGameId, targetGroupId);
    if (!destination) {
      return;
    }

    if (found.container === destination.container) {
      return;
    }

    found.container.tasks = found.container.tasks.filter((task) => task.id !== taskId);
    destination.container.tasks.push(found.entity);
  }

  function deleteEntity(entityType, id) {
    if (entityType === "game") {
      state.data.games = state.data.games.filter((game) => game.id !== id);
      if (state.view.gameId === id) {
        state.view.mode = "global";
        state.view.gameId = null;
        state.view.groupKey = null;
      }
      return;
    }

    if (entityType === "group") {
      state.data.games.forEach((game) => {
        game.groups = (game.groups || []).filter((group) => group.id !== id);
      });
      return;
    }

    state.data.games.forEach((game) => {
      game.tasks = (game.tasks || []).filter((task) => task.id !== id);
      (game.groups || []).forEach((group) => {
        group.tasks = (group.tasks || []).filter((task) => task.id !== id);
      });
    });
  }

  function completeTask(taskId) {
    const found = findEntityById("task", taskId);
    if (!found) {
      return;
    }
    if (found.entity.isDisabled || (found.parent && found.parent.isDisabled)) {
      return;
    }
    if (found.entity.completedAt && (found.entity.type === "one-time" || found.entity.type === "event")) {
      return;
    }
    found.entity.completedAt = new Date().toISOString();
    saveState();
    render();
  }

  function undoTask(taskId) {
    const found = findEntityById("task", taskId);
    if (!found) {
      return;
    }
    found.entity.completedAt = null;
    saveState();
    render();
  }

  function completeGroupAvailableTasks(groupKey) {
    const model = deriveModel();
    const section = model.groupSections.find((group) => group.groupKey === groupKey);
    if (!section) {
      return;
    }
    const openCount = section.tasks.filter((task) => task.canComplete && task.status === "available").length;
    if (!openCount) {
      return;
    }
    openConfirmation({
      title: "Complete group tasks",
      message: `Mark ${openCount} open task${openCount === 1 ? "" : "s"} as complete in ${section.name}?`,
      confirmLabel: "Complete all",
      danger: false,
      onConfirm: () => {
        section.tasks
          .filter((task) => task.canComplete && task.status === "available")
          .forEach((task) => {
            const found = findEntityById("task", task.id);
            if (found) {
              found.entity.completedAt = new Date().toISOString();
            }
          });
        saveState();
        render();
      },
    });
  }

  function toggleEntityDisabled(entityType, id) {
    const found = findEntityById(entityType, id);
    if (!found) {
      return;
    }
    found.entity.isDisabled = !found.entity.isDisabled;
    if (entityType === "task" && found.entity.isDisabled) {
      found.entity.completedAt = null;
    }
    saveState();
    render();
  }

  function collapseAllGroups(groupSections) {
    groupSections.forEach((group) => {
      state.collapsedGroups[group.groupKey] = true;
    });
    saveUiPrefs();
    render();
  }

  function expandAllGroups() {
    state.collapsedGroups = {};
    saveUiPrefs();
    render();
  }

  function exportGroupJson(groupKey) {
    const model = deriveModel();
    const section = model.games
      .flatMap((game) => game.groups)
      .find((group) => group.groupKey === groupKey);
    if (!section) {
      return;
    }

    const payload = {
      game: {
        id: section.gameId,
        name: section.gameName,
      },
      group: {
        id: section.id,
        name: section.name,
        notes: section.notes,
        priority: section.priority,
        expiresAt: section.expiresAt,
        resetOverrideEnabled: section.resetOverrideEnabled,
        resetSettings: section.resetSettings,
        tasks: section.tasks.map((task) => {
          const found = findEntityById("task", task.id);
          return found ? found.entity : task;
        }),
      },
    };

    downloadJson(payload, `${slugify(section.gameName)}-${slugify(section.name)}-group.json`);
  }

  function findTaskParent(groupId) {
    for (const game of state.data.games) {
      const group = (game.groups || []).find((item) => item.id === groupId);
      if (group) {
        return group;
      }
    }
    return null;
  }

  function findEntityById(entityType, id) {
    if (entityType === "game") {
      const game = state.data.games.find((item) => item.id === id);
      return game ? { entity: game } : null;
    }

    for (const game of state.data.games) {
      if (entityType === "task") {
        for (const task of game.tasks || []) {
          if (task.id === id) {
            return {
              entity: task,
              container: game,
              parent: null,
              parentType: "game",
              game,
            };
          }
        }
      }

      for (const group of game.groups || []) {
        if (entityType === "group" && group.id === id) {
          return { entity: group, parent: game };
        }
        if (entityType === "task") {
          for (const task of group.tasks || []) {
            if (task.id === id) {
              return {
                entity: task,
                container: group,
                parent: group,
                parentType: "group",
                game,
              };
            }
          }
        }
      }
    }

    return null;
  }

  function getAvailableGamesForEditor() {
    return state.data.games.map((game) => ({ id: game.id, name: game.name }));
  }

  function getAvailableGroupsForEditor() {
    return state.data.games.flatMap((game) => getAvailableGroupsForGame(game.id));
  }

  function getAvailableGroupsForGame(gameId) {
    const game = state.data.games.find((item) => item.id === gameId);
    if (!game) {
      return [];
    }
    return (game.groups || []).map((group) => ({
      id: group.id,
      name: group.name,
      groupKey: group.id,
      gameId: game.id,
      gameName: game.name,
      isEventGroup: Boolean(group.isEventGroup),
    }));
  }

  function resolveGroupIdFromKey(groupKey) {
    if (!groupKey || groupKey.endsWith("::ungrouped")) {
      return "";
    }
    const group = getAvailableGroupsForEditor().find((item) => item.groupKey === groupKey);
    return group ? group.id : "";
  }

  function getTaskContainer(gameId, groupId) {
    const game = state.data.games.find((item) => item.id === gameId);
    if (!game) {
      return null;
    }

    if (groupId) {
      const group = (game.groups || []).find((item) => item.id === groupId);
      return group ? { container: group, game } : null;
    }

    game.tasks = Array.isArray(game.tasks) ? game.tasks : [];
    return {
      container: game,
      game,
    };
  }

  function getEntityDisplayName(entityType, id) {
    const found = findEntityById(entityType, id);
    if (!found || !found.entity) {
      return "this item";
    }
    return `"${found.entity.name || entityType}"`;
  }

  function prepareImportedGame(game, existingIds) {
    const clone = JSON.parse(JSON.stringify(game));
    clone.groups = Array.isArray(clone.groups) ? clone.groups : [];
    clone.tasks = Array.isArray(clone.tasks) ? clone.tasks : [];
    clone.id = ensureUniqueId(clone.id || "game-import", existingIds);
    existingIds.add(clone.id);

    clone.tasks = clone.tasks.map((task) => {
      const preparedTask = { ...task };
      preparedTask.id = ensureUniqueId(preparedTask.id || `${clone.id}-task`, existingIds);
      existingIds.add(preparedTask.id);
      return preparedTask;
    });

    clone.groups = clone.groups.map((group) => {
      const preparedGroup = {
        ...group,
        tasks: Array.isArray(group.tasks) ? group.tasks : [],
      };
      preparedGroup.id = ensureUniqueId(preparedGroup.id || `${clone.id}-group`, existingIds);
      existingIds.add(preparedGroup.id);
      preparedGroup.tasks = preparedGroup.tasks.map((task) => {
        const preparedTask = { ...task };
        preparedTask.id = ensureUniqueId(preparedTask.id || `${preparedGroup.id}-task`, existingIds);
        existingIds.add(preparedTask.id);
        return preparedTask;
      });
      return preparedGroup;
    });

    return clone;
  }

  function collectExistingIds(data) {
    const ids = new Set();
    data.games.forEach((game) => {
      ids.add(game.id);
      (game.tasks || []).forEach((task) => {
        ids.add(task.id);
      });
      (game.groups || []).forEach((group) => {
        ids.add(group.id);
        (group.tasks || []).forEach((task) => {
          ids.add(task.id);
        });
      });
    });
    return ids;
  }

  function requestRestoreDemo() {
    openConfirmation({
      title: "Restore demo data",
      message: "Replace your current tracker with fresh demo data? This will overwrite your local tracker.",
      confirmLabel: "Restore demo",
      danger: true,
      onConfirm: restoreDemoData,
    });
  }

  function requestResetProgress() {
    openConfirmation({
      title: "Reset progress",
      message: "Mark every task in the tracker as incomplete? This keeps your games, groups, and settings, but clears all completion progress.",
      confirmLabel: "Reset progress",
      danger: true,
      onConfirm: resetAllProgress,
    });
  }

  function resetAllProgress() {
    state.data.games.forEach((game) => {
      (game.tasks || []).forEach((task) => {
        task.completedAt = null;
      });
      (game.groups || []).forEach((group) => {
        (group.tasks || []).forEach((task) => {
          task.completedAt = null;
        });
      });
    });
    saveState();
    render();
  }

  function restoreDemoData() {
    state.data = CONFIG.buildDemoData();
    saveState();
    render();
  }

  function dayName(dayNumber) {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayNumber] || "Monday";
  }

  function formatDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function formatCountdown(diffMs) {
    if (diffMs <= 0) {
      return "now";
    }

    const totalMinutes = Math.floor(diffMs / (60 * 1000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  function toDateTimeLocalValue(isoString) {
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function createDemoData() {
    return CONFIG.buildDemoData();
  }
})();
