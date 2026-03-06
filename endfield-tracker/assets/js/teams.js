// --- Roster data (edit later to match real data) ---
  const rosterData = [
    { id:"yvonne", name:"Yvonne", img:"Yvonne_card.webp", rarity:6, tags:["Cryo","DPS"] },
    { id:"lastrite", name:"Last Rite", img:"lastrite_card.webp", rarity:6, tags:["Electric","DPS"] },
    { id:"pograni", name:"Pogranichnik", img:"pog_card.webp", rarity:5, tags:["Physical","DPS"] },
    { id:"ardelia", name:"Ardelia", img:"ardelia_card.webp", rarity:5, tags:["Nature","Support"] },
    { id:"chen", name:"Chen Qianyu", img:"Chen_Qianyu_card.webp", rarity:4, tags:["Physical","Support"] },
    { id:"endmin", name:"Endministrator", img:"Endministrator_card.webp", rarity:4, tags:["Physical","DPS"] },
    { id:"xaihi", name:"Xaihi", img:"Xaihi_card.webp", rarity:5, tags:["Cryo","Support"] },
    { id:"fluorite", name:"Fluorite", img:"fluorite_card.webp", rarity:4, tags:["Nature","Support"] },
  ];
  const TEAM_SIZE = 4;

  const rarityVar = (r) => r === 6 ? "var(--gold)" : r === 5 ? "var(--purple)" : "var(--blue)";
  const stars = (r) => "★".repeat(r);

  // --- Storage ---
  const LS_KEY = "endfieldTeams.v1";
  function loadTeams(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }catch{ return []; }
  }
  function saveTeams(teams){
    localStorage.setItem(LS_KEY, JSON.stringify(teams));
  }

  // Team shape: { id, name, members: [rosterId,...] }
  let teams = loadTeams();
  let activeTeamId = teams[0]?.id ?? null;

  // --- DOM ---
  const teamList = document.getElementById("teamList");
  const builderTitle = document.getElementById("builderTitle");
  const teamNameInput = document.getElementById("teamNameInput");
  const saveNameBtn = document.getElementById("saveNameBtn");
  const membersEl = document.getElementById("members");

  const rosterEl = document.getElementById("roster");
  const rosterCount = document.getElementById("rosterCount");
  const searchInput = document.getElementById("searchInput");

  const newTeamBtn = document.getElementById("newTeamBtn");
  const clearTeamBtn = document.getElementById("clearTeamBtn");
  const deleteTeamBtn = document.getElementById("deleteTeamBtn");

  // --- Helpers ---
  const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
  const getTeam = () => teams.find(t => t.id === activeTeamId) ?? null;
  const getOp = (id) => rosterData.find(o => o.id === id);

  function ensureStarterTeam(){
    if(teams.length) return;
    teams = [{ id: uid(), name: "Team 1", members: [] }];
    activeTeamId = teams[0].id;
    saveTeams(teams);
  }

  function setActiveTeam(id){
    activeTeamId = id;
    render();
  }

  function createTeam(){
    const n = teams.length + 1;
    const t = { id: uid(), name: `Team ${n}`, members: [] };
    teams.unshift(t);
    activeTeamId = t.id;
    saveTeams(teams);
    render();
  }

  function deleteTeam(id){
    teams = teams.filter(t => t.id !== id);
    if(activeTeamId === id) activeTeamId = teams[0]?.id ?? null;
    saveTeams(teams);
    render();
  }

  function clearTeam(){
    const t = getTeam();
    if(!t) return;
    t.members = [];
    saveTeams(teams);
    renderMembers();
    renderRoster();
    renderTeams();
  }

  function addMember(opId){
    const t = getTeam();
    if(!t) return;
    if(t.members.includes(opId)) return;
    if(t.members.length >= TEAM_SIZE) return; // enforce 4
    t.members.push(opId);
    saveTeams(teams);
    renderMembers();
    renderRoster();
    renderTeams();
  }

  function removeMember(opId){
    const t = getTeam();
    if(!t) return;
    t.members = t.members.filter(x => x !== opId);
    saveTeams(teams);
    renderMembers();
    renderRoster();
    renderTeams();
  }

  // Drag & drop reorder (swap)
  let dragOpId = null;
  function onDragStart(opId){ dragOpId = opId; }
  function onDrop(targetOpId){
    const t = getTeam();
    if(!t || !dragOpId) return;
    const a = t.members.slice();
    const from = a.indexOf(dragOpId);
    const to = a.indexOf(targetOpId);
    if(from < 0 || to < 0 || from === to) return;
    // swap
    [a[from], a[to]] = [a[to], a[from]];
    t.members = a;
    dragOpId = null;
    saveTeams(teams);
    renderMembers();
  }

  // --- Render ---
  function renderTeams(){
    teamList.innerHTML = "";
    for(const t of teams){
      const members = t.members.length;
      const item = document.createElement("div");
      item.className = "teamItem" + (t.id === activeTeamId ? " active" : "");
      item.innerHTML = `
        <div class="teamMeta">
          <p class="teamName">${t.name}</p>
          <div class="teamSub">${members} / ${TEAM_SIZE} members</div>
        </div>
        <div class="teamActions">
          <button class="iconBtn" title="Select">Open</button>
          <button class="iconBtn danger" title="Delete">Del</button>
        </div>
      `;
      item.querySelector(".iconBtn").addEventListener("click", (e)=>{ e.stopPropagation(); setActiveTeam(t.id); });
      item.querySelector(".iconBtn.danger").addEventListener("click", (e)=>{ e.stopPropagation(); deleteTeam(t.id); });
      item.addEventListener("click", ()=> setActiveTeam(t.id));
      teamList.appendChild(item);
    }
  }

  function renderBuilderHeader(){
    const t = getTeam();
    const has = !!t;
    builderTitle.textContent = has ? t.name : "Select a team";
    teamNameInput.disabled = !has;
    saveNameBtn.disabled = !has;
    clearTeamBtn.disabled = !has;
    deleteTeamBtn.disabled = !has;
    teamNameInput.value = has ? t.name : "";
  }

  function renderMembers(){
    const t = getTeam();
    membersEl.innerHTML = "";
    const members = t?.members ?? [];

    for(let i=0;i<TEAM_SIZE;i++){
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.innerHTML = `<div class="slotTitle">Slot ${i+1}</div><div class="dropHint">Drop</div>`;

      const opId = members[i];
      if(opId){
        const op = getOp(opId);
        const card = document.createElement("div");
        card.className = "member";
        card.draggable = true;
        card.innerHTML = `
          <div class="mRow">
            <img class="mImg" src="${op.img}" alt="${op.name}" />
            <div class="mText">
              <div class="mName">${op.name}</div>
              <div class="mTags">${op.tags.join(" • ")}</div>
            </div>
            <div class="mBtns">
              <button class="tiny remove">Remove</button>
            </div>
          </div>
        `;
        card.addEventListener("dragstart", ()=> onDragStart(opId));
        card.addEventListener("dragover", (e)=> e.preventDefault());
        card.addEventListener("drop", (e)=>{ e.preventDefault(); onDrop(opId); });

        card.querySelector(".remove").addEventListener("click", (e)=>{
          e.stopPropagation();
          removeMember(opId);
        });

        slot.appendChild(card);
      } else {
        slot.style.color = "rgba(255,255,255,.55)";
        slot.style.fontWeight = "900";
        slot.style.letterSpacing = ".10em";
        slot.style.textTransform = "uppercase";
        slot.style.fontSize = "12px";
        slot.style.paddingTop = "24px";
        slot.appendChild(document.createTextNode("Empty"));
      }

      // visual drop target
      slot.addEventListener("dragover", (e)=>{ e.preventDefault(); slot.classList.add("dragover"); });
      slot.addEventListener("dragleave", ()=> slot.classList.remove("dragover"));
      slot.addEventListener("drop", (e)=>{
        e.preventDefault();
        slot.classList.remove("dragover");
      });

      membersEl.appendChild(slot);
    }
  }

  function renderRoster(){
    rosterEl.innerHTML = "";
    const t = getTeam();
    const selected = new Set(t?.members ?? []);
    const q = (searchInput.value || "").trim().toLowerCase();
    const list = rosterData.filter(op => {
      if(!q) return true;
      return op.name.toLowerCase().includes(q) || op.tags.join(" ").toLowerCase().includes(q);
    });

    rosterCount.textContent = `${list.length} shown`;

    const teamFull = (t?.members?.length ?? 0) >= TEAM_SIZE;

    for(const op of list){
      const article = document.createElement("article");
      article.className = "card";
      article.style.setProperty("--rarity", rarityVar(op.rarity));
      const already = selected.has(op.id);
      article.innerHTML = `
        <img class="art" src="${op.img}" alt="${op.name}">
        <div class="fade"></div>
        <button class="add" ${already || teamFull ? "disabled" : ""}>
          ${already ? "In Team" : teamFull ? "Team Full" : "Add"}
        </button>
        <div class="meta">
          <div>
            <p class="cName">${op.name}</p>
            <div class="cStars">${stars(op.rarity)}</div>
          </div>
        </div>
      `;
      article.querySelector(".add").addEventListener("click", (e)=>{
        e.stopPropagation();
        addMember(op.id);
      });
      rosterEl.appendChild(article);
    }
  }

  function render(){
    renderTeams();
    renderBuilderHeader();
    renderMembers();
    renderRoster();
  }

  // --- Wiring ---
  ensureStarterTeam();
  render();

  newTeamBtn.addEventListener("click", createTeam);
  clearTeamBtn.addEventListener("click", clearTeam);
  deleteTeamBtn.addEventListener("click", ()=> {
    const t = getTeam();
    if(!t) return;
    deleteTeam(t.id);
  });

  saveNameBtn.addEventListener("click", ()=>{
    const t = getTeam();
    if(!t) return;
    t.name = teamNameInput.value.trim() || "Untitled Team";
    saveTeams(teams);
    renderTeams();
    renderBuilderHeader();
  });

  searchInput.addEventListener("input", renderRoster);
