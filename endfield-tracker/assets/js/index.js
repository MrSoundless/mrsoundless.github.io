const rosterData = [
    { id:"yvonne", name:"Yvonne", img:"Yvonne_card.webp", rarity:6 },
    { id:"lastrite", name:"Last Rite", img:"lastrite_card.webp", rarity:6 },
    { id:"pograni", name:"Pogranichnik", img:"pog_card.webp", rarity:5 },
    { id:"ardelia", name:"Ardelia", img:"ardelia_card.webp", rarity:5 },
    { id:"chen", name:"Chen Qianyu", img:"Chen_Qianyu_card.webp", rarity:4 },
    { id:"endmin", name:"Endministrator", img:"Endministrator_card.webp", rarity:4 },
    { id:"xaihi", name:"Xaihi", img:"Xaihi_card.webp", rarity:5 },
    { id:"fluorite", name:"Fluorite", img:"fluorite_card.webp", rarity:4 },
  ];

  const LS_TEAMS = "endfieldTeams.v1";
  const LS_OWNED = "endfieldOwned.v1"; // simple owned map

  const rarityVar = (r) => r === 6 ? "var(--gold)" : r === 5 ? "var(--purple)" : "var(--blue)";
  const stars = (r) => "★".repeat(r);

  function loadOwned(){
    try{
      const raw = localStorage.getItem(LS_OWNED);
      if(!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    }catch{ return {}; }
  }
  function saveOwned(map){
    localStorage.setItem(LS_OWNED, JSON.stringify(map));
  }
  function loadTeams(){
    try{
      const raw = localStorage.getItem(LS_TEAMS);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch{ return []; }
  }

  function buildTeamUsage(teams){
    // opId -> count of teams containing it
    const usage = new Map();
    for(const t of teams){
      for(const id of (t.members || [])){
        usage.set(id, (usage.get(id) || 0) + 1);
      }
    }
    return usage;
  }

  const grid = document.getElementById("grid");
  const searchInput = document.getElementById("searchInput");
  const ownedCountEl = document.getElementById("ownedCount");
  const totalCountEl = document.getElementById("totalCount");
  const shownCountEl = document.getElementById("shownCount");

  const state = { ownedFilter:"all", search:"" };

  let ownedMap = loadOwned();
  let teams = loadTeams();
  let usage = buildTeamUsage(teams);

  function isOwned(id){ return !!ownedMap[id]; }

  function setOwnedFilter(val){
    state.ownedFilter = val;
    document.querySelectorAll("[data-owned]").forEach(btn=>{
      btn.classList.toggle("active", btn.dataset.owned === val);
    });
    render();
  }

  function matches(op){
    if(state.ownedFilter === "owned" && !isOwned(op.id)) return false;
    if(state.ownedFilter === "unowned" && isOwned(op.id)) return false;
    if(state.search){
      const q = state.search;
      if(!op.name.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  function updateCounts(shown){
    totalCountEl.textContent = String(rosterData.length);
    ownedCountEl.textContent = String(rosterData.filter(o=>isOwned(o.id)).length);
    shownCountEl.textContent = String(shown);
  }

  function render(){
    grid.innerHTML = "";
    let shown = 0;

    for(const op of rosterData){
      if(!matches(op)) continue;
      shown++;

      const card = document.createElement("article");
      card.className = "card" + (isOwned(op.id) ? "" : " unowned");
      card.style.setProperty("--rarity", rarityVar(op.rarity));

      const teamCount = usage.get(op.id) || 0;

      card.innerHTML = `
        ${teamCount ? `<div class="teamBadge" title="Used in teams">In ${teamCount} team${teamCount===1?"":"s"}</div>` : ""}
        <img class="art" src="${op.img}" alt="${op.name}">
        <div class="fade"></div>
        <div class="owned" data-toggle-owned>${isOwned(op.id) ? "Owned" : "Unowned"}</div>
        <div class="meta">
          <div>
            <p class="cName">${op.name}</p>
            <div class="cStars">${stars(op.rarity)}</div>
          </div>
        </div>
      `;

      card.querySelector("[data-toggle-owned]").addEventListener("click", (e)=>{
        e.stopPropagation();
        ownedMap[op.id] = !isOwned(op.id);
        saveOwned(ownedMap);
        render();
      });

      const tb = card.querySelector(".teamBadge");
      if(tb){
        tb.addEventListener("click", (e)=>{
          e.stopPropagation();
          window.location.href = "teams.html";
        });
      }

      grid.appendChild(card);
    }

    updateCounts(shown);
  }

  // Owned filter pills
  document.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-owned]");
    if(!btn) return;
    setOwnedFilter(btn.dataset.owned);
  });

  searchInput.addEventListener("input", (e)=>{
    state.search = e.target.value.trim().toLowerCase();
    render();
  });

  // Initial
  render();

  // Keep team usage fresh if teams change in another tab
  window.addEventListener("storage", (e)=>{
    if(e.key === LS_TEAMS){
      teams = loadTeams();
      usage = buildTeamUsage(teams);
      render();
    }
    if(e.key === LS_OWNED){
      ownedMap = loadOwned();
      render();
    }
  });
