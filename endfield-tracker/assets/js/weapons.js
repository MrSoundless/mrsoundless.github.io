// --- Replace these with real weapons + images you downloaded ---
  // Put the weapon images in the same folder and update the "img" filenames.
  const weaponsData = [
    { id:"grand_vision", name:"Grand Vision", img:"wep_grand_vision.webp", rarity:6 },
    { id:"sundering_steel", name:"Sundering Steel", img:"wep_sundering_steel.webp", rarity:5 },
    { id:"thermite_cutter", name:"Thermite Cutter", img:"wep_thermite_cutter.webp", rarity:5 },
    { id:"dreams_starry_beach", name:"Dreams of the Starry Beach", img:"wep_dreams_starry_beach.webp", rarity:6 },
    { id:"chivalric_virtues", name:"Chivalric Virtues", img:"wep_chivalric_virtues.webp", rarity:4 },
    { id:"wild_wanderer", name:"Wild Wanderer", img:"wep_wild_wanderer.webp", rarity:4 },
    { id:"finishing_call", name:"Finishing Call", img:"wep_finishing_call.webp", rarity:4 },
    { id:"obj_velocitous", name:"OBJ Velocitous", img:"wep_obj_velocitous.webp", rarity:5 },
  ];

  const LS_OWNED_WEAPONS = "endfieldOwnedWeapons.v1";

  const rarityVar = (r) => r === 6 ? "var(--gold)" : r === 5 ? "var(--purple)" : "var(--blue)";
  const stars = (r) => "★".repeat(r);

  function loadOwned(){
    try{
      const raw = localStorage.getItem(LS_OWNED_WEAPONS);
      if(!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    }catch{ return {}; }
  }
  function saveOwned(map){
    localStorage.setItem(LS_OWNED_WEAPONS, JSON.stringify(map));
  }

  const grid = document.getElementById("grid");
  const searchInput = document.getElementById("searchInput");
  const ownedCountEl = document.getElementById("ownedCount");
  const totalCountEl = document.getElementById("totalCount");
  const shownCountEl = document.getElementById("shownCount");

  const state = { ownedFilter:"all", search:"" };
  let ownedMap = loadOwned();

  function isOwned(id){ return !!ownedMap[id]; }

  function setOwnedFilter(val){
    state.ownedFilter = val;
    document.querySelectorAll("[data-owned]").forEach(btn=>{
      btn.classList.toggle("active", btn.dataset.owned === val);
    });
    render();
  }

  function matches(w){
    if(state.ownedFilter === "owned" && !isOwned(w.id)) return false;
    if(state.ownedFilter === "unowned" && isOwned(w.id)) return false;
    if(state.search){
      const q = state.search;
      if(!w.name.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  function updateCounts(shown){
    totalCountEl.textContent = String(weaponsData.length);
    ownedCountEl.textContent = String(weaponsData.filter(w=>isOwned(w.id)).length);
    shownCountEl.textContent = String(shown);
  }

  function render(){
    grid.innerHTML = "";
    let shown = 0;

    for(const w of weaponsData){
      if(!matches(w)) continue;
      shown++;

      const card = document.createElement("article");
      card.className = "card" + (isOwned(w.id) ? "" : " unowned");
      card.style.setProperty("--rarity", rarityVar(w.rarity));

      card.innerHTML = `
        <img class="art" src="${w.img}" alt="${w.name}">
        <div class="fade"></div>
        <div class="owned" data-toggle-owned>${isOwned(w.id) ? "Owned" : "Unowned"}</div>
        <div class="meta">
          <div>
            <p class="cName">${w.name}</p>
            <div class="cStars">${stars(w.rarity)}</div>
          </div>
        </div>
      `;

      card.querySelector("[data-toggle-owned]").addEventListener("click", (e)=>{
        e.stopPropagation();
        ownedMap[w.id] = !isOwned(w.id);
        saveOwned(ownedMap);
        render();
      });

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

  // Keep in sync if opened in multiple tabs
  window.addEventListener("storage", (e)=>{
    if(e.key === LS_OWNED_WEAPONS){
      ownedMap = loadOwned();
      render();
    }
  });
