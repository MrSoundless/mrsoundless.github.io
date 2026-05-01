const DATACENTER_WORLDS = {
  Aether: ["Adamantoise", "Cactuar", "Faerie", "Gilgamesh", "Jenova", "Midgardsormr", "Sargatanas", "Siren"],
  Chaos: ["Cerberus", "Louisoix", "Moogle", "Omega", "Phantom", "Ragnarok", "Sagittarius", "Spriggan"],
  Crystal: ["Balmung", "Brynhildr", "Coeurl", "Diabolos", "Goblin", "Malboro", "Mateus", "Zalera"],
  Light: ["Alpha", "Lich", "Odin", "Phoenix", "Raiden", "Shiva", "Twintania", "Zodiark"],
  Primal: ["Behemoth", "Excalibur", "Exodus", "Famfrit", "Hyperion", "Lamia", "Leviathan", "Ultros"],
};
const SUPPORTED_DATACENTERS = Object.keys(DATACENTER_WORLDS).sort(compareNames);
const TEAMCRAFT_ITEMS_URL = "https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/master/libs/data/src/lib/json/items.json";
const TEAMCRAFT_RECIPES_URL = "https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/master/libs/data/src/lib/json/recipes.json";
const XIVAPI_SEARCH_URL = "https://xivapi.com/search?indexes=item&string=";
const UNIVERSALIS_BASE_URL = "https://universalis.app/api/v2";
const LOCAL_STORAGE_IDS_CACHE_KEY = "ffxivCraftAdvisorItemCache";
const LOCAL_STORAGE_PREFERENCES_KEY = "ffxivCraftAdvisorPreferences";
const LOCAL_STORAGE_INGREDIENT_CACHE_KEY = "ffxivCraftAdvisorIngredientNames";
const RECENT_HISTORY_SAMPLE_SIZE = 20;
const MAX_CRAFT_CHAIN_DEPTH = 5;
const MAX_SALES_ACTIVITY_CANDIDATES = 6;
const MAX_ALTERNATIVE_SUGGESTIONS = 3;
const MAX_INGREDIENT_SUGGESTIONS = 16;
const MIN_INGREDIENT_SEARCH_LENGTH = 2;

let teamcraftItems = null;
let teamcraftRecipes = null;
let ingredientNames = null;
let ingredientSearchIndex = null;
const itemIdLookupCache = loadItemIdCache();

const datacenterSelect = document.getElementById("datacenter");
const serverSelect = document.getElementById("server");
const ingredientInput = document.getElementById("ingredient");
const quantityInput = document.getElementById("quantity");
const form = document.getElementById("advisor-form");
const resultSection = document.getElementById("results");
const resultOutput = document.getElementById("result-output");
const ingredientList = document.getElementById("ingredient-list");
const savedPreferences = loadPreferences();

initializeDropdowns();
initializeIngredientAutocomplete();

async function loadIngredientNames() {
  try {
    if (ingredientNames) {
      return ingredientNames;
    }

    const cachedNames = loadIngredientNameCache();
    if (cachedNames.length > 0) {
      ingredientNames = cachedNames;
      ingredientSearchIndex = buildIngredientSearchIndex(ingredientNames);
      return ingredientNames;
    }

    const recipes = await loadTeamcraftRecipes();
    ingredientNames = Array.from(new Set(
      recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name))
    )).sort(compareNames);
    ingredientSearchIndex = buildIngredientSearchIndex(ingredientNames);
    saveIngredientNameCache(ingredientNames);

    return ingredientNames;
  } catch (error) {
    console.warn("Could not load ingredient names:", error);
    return [];
  }
}

async function updateIngredientSuggestions(query) {
  const normalizedQuery = query.trim().toLowerCase();
  ingredientList.innerHTML = "";

  if (normalizedQuery.length < MIN_INGREDIENT_SEARCH_LENGTH) {
    return;
  }

  const allNames = await loadIngredientNames();
  const prefixKey = normalizedQuery.slice(0, MIN_INGREDIENT_SEARCH_LENGTH);
  const searchPool = ingredientSearchIndex?.get(prefixKey) || allNames;
  const startsWithMatches = [];
  const includesMatches = [];

  for (const name of searchPool) {
    const normalizedName = name.toLowerCase();
    if (normalizedName.startsWith(normalizedQuery)) {
      startsWithMatches.push(name);
    } else if (normalizedName.includes(normalizedQuery)) {
      includesMatches.push(name);
    }

    if ((startsWithMatches.length + includesMatches.length) >= MAX_INGREDIENT_SUGGESTIONS) {
      break;
    }
  }

  const dedupedMatches = [...startsWithMatches, ...includesMatches]
    .slice(0, MAX_INGREDIENT_SUGGESTIONS)
    .filter((name, index, matches) => matches.indexOf(name) === index);

  dedupedMatches.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      ingredientList.appendChild(option);
    });
}

function initializeIngredientAutocomplete() {
  ingredientInput.addEventListener("focus", () => {
    if (ingredientInput.value.trim().length >= MIN_INGREDIENT_SEARCH_LENGTH) {
      updateIngredientSuggestions(ingredientInput.value);
      ingredientInput.showPicker?.();
    }
  });

  ingredientInput.addEventListener("input", () => {
    updateIngredientSuggestions(ingredientInput.value);
    if (ingredientInput.value.trim().length >= MIN_INGREDIENT_SEARCH_LENGTH) {
      ingredientInput.showPicker?.();
    }
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const datacenter = datacenterSelect.value;
  const server = serverSelect.value.trim();
  const rawIngredient = ingredientInput.value.trim();
  const quantity = Number(quantityInput.value);

  if (!SUPPORTED_DATACENTERS.includes(datacenter)) {
    displayError(`Unknown datacenter: ${datacenter}`);
    return;
  }

  if (!rawIngredient || quantity <= 0) {
    displayError("Please enter a valid ingredient and quantity.");
    return;
  }

  const canonicalIngredient = await normalizeItemName(rawIngredient);
  const allRecipes = await loadTeamcraftRecipes();
  const candidateRecipes = collectCandidateRecipes(canonicalIngredient, allRecipes);

  resultSection.classList.remove("hidden");
  resultOutput.innerHTML = `<div class="result-block"><p>Checking deep craft paths and recent market activity for ${canonicalIngredient}...</p></div>`;

  try {
    const plans = buildCraftPlans(canonicalIngredient, candidateRecipes, allRecipes);
    const itemNames = new Set([canonicalIngredient]);
    plans.forEach((plan) => {
      itemNames.add(plan.name);
      Object.keys(plan.requirements).forEach((name) => itemNames.add(name));
    });

    const itemIdsByName = {};
    for (const name of itemNames) {
      const itemId = await getItemId(name);
      if (!itemId) {
        throw new Error(`Unable to resolve the item ID for ${name}. Please try a more exact item name.`);
      }
      itemIdsByName[name] = itemId;
    }

    const marketScope = server || datacenter;
    const pricesByName = await fetchMarketPrices(marketScope, itemIdsByName);
    const rawPrice = pricesByName[canonicalIngredient];

    if (rawPrice == null) {
      throw new Error(`No current market price found for ${canonicalIngredient} in ${marketScope}.`);
    }

    const rawSellValue = rawPrice * quantity;
    const craftOptions = plans.map((plan) => {
      const recipeInputQty = plan.rootIngredientQty;
      const totalCost = Object.entries(plan.requirements).reduce((sum, [name, qty]) => {
        const ingredientPrice = pricesByName[name] || 0;
        return sum + (ingredientPrice * qty);
      }, 0);

      const outputPrice = pricesByName[plan.name] ?? null;
      const grossRevenuePerCraft = outputPrice != null ? outputPrice * plan.outputQty : null;
      const profitPerCraft = grossRevenuePerCraft != null ? grossRevenuePerCraft - totalCost : null;
      const profitPerInput = profitPerCraft != null && recipeInputQty > 0 ? profitPerCraft / recipeInputQty : null;
      const maxCraftCount = recipeInputQty > 0 ? Math.floor((quantity / recipeInputQty) + 1e-9) : 0;
      const totalProfit = profitPerCraft != null ? profitPerCraft * maxCraftCount : null;
      const recipeMissingPrice = [plan.name, ...Object.keys(plan.requirements)]
        .some((name) => pricesByName[name] == null);

      return {
        ...plan,
        inputQty: recipeInputQty,
        outputPrice,
        grossRevenuePerCraft,
        totalCost,
        profitPerCraft,
        profitPerInput,
        maxCraftCount,
        totalProfit,
        rawSellValue,
        recipeMissingPrice,
        salesActivity: createEmptySalesActivity(),
      };
    });

    const pricedCrafts = craftOptions.filter(
      (option) => option.maxCraftCount > 0
        && option.outputPrice != null
        && !option.recipeMissingPrice
    );

    const prioritizedCrafts = pricedCrafts
      .sort((left, right) => (right.profitPerInput ?? -Infinity) - (left.profitPerInput ?? -Infinity))
      .slice(0, MAX_SALES_ACTIVITY_CANDIDATES);

    const craftSalesByName = await fetchCraftSalesActivity(marketScope, prioritizedCrafts, itemIdsByName);
    prioritizedCrafts.forEach((option) => {
      option.salesActivity = craftSalesByName[option.name] || createEmptySalesActivity();
      option.salesScore = scoreSalesActivity(option.salesActivity);
      option.overallScore = scoreCraftOption(option, rawSellValue);
    });

    const viableCrafts = prioritizedCrafts
      .filter((option) => option.salesScore > 0 && option.salesActivity.label !== "Slow seller")
      .sort((left, right) => right.overallScore - left.overallScore);

    const bestCraft = viableCrafts[0] || null;
    const alternativeCrafts = viableCrafts
      .slice(1, 1 + MAX_ALTERNATIVE_SUGGESTIONS)
      .filter((option) => option.name !== bestCraft?.name);

    displayBestOption({ rawSellValue, bestCraft, alternativeCrafts, ingredient: canonicalIngredient, quantity, pricesByName });
  } catch (error) {
    displayError(error.message || "Unable to fetch market data. Try again later.");
  }
});

function displayError(message) {
  resultSection.classList.remove("hidden");
  resultOutput.innerHTML = `<div class="result-block"><p><strong>Error:</strong> ${message}</p></div>`;
}

function displayBestOption({ rawSellValue, bestCraft, alternativeCrafts, ingredient, quantity, pricesByName }) {
  const rawUnitPrice = pricesByName[ingredient];
  const rawStatement = `Selling ${quantity} ${ingredient}${quantity === 1 ? "" : "s"} raw at ${formatPrice(rawUnitPrice)} each yields ${formatPrice(rawSellValue)}.`;

  if (!bestCraft) {
    resultOutput.innerHTML = `
      <div class="result-summary result-summary--raw">
        <div class="result-head">
          <span class="result-badge">Best Option</span>
          <h3>Sell the raw ingredient</h3>
          <p>No crafted item with both reliable pricing and recent sales activity was found for ${ingredient}.</p>
        </div>
        <div class="result-stats">
          ${renderStatCard("Raw Unit Price", formatPrice(rawUnitPrice))}
          ${renderStatCard("Raw Total Value", formatPrice(rawSellValue))}
          ${renderStatCard("Craft Options", "No strong match")}
        </div>
        <div class="result-notes">
          <div class="result-note">
            <h4>Why</h4>
            <p>${rawStatement}</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const craftBeatsRaw = bestCraft.profitPerCraft > 0 && bestCraft.totalProfit > 0 && bestCraft.totalProfit > rawSellValue;
  const craftIsProfitableButNotBest = bestCraft.profitPerCraft > 0 && !craftBeatsRaw;
  const recommendationTitle = craftBeatsRaw ? `Craft ${bestCraft.name}` : "Sell the raw ingredient";
  const recommendationTone = craftBeatsRaw ? "craft" : "raw";
  const recommendationSummary = craftBeatsRaw
    ? `Craft up to ${bestCraft.maxCraftCount} and aim for about ${formatPrice(bestCraft.totalProfit)} total profit.`
    : craftIsProfitableButNotBest
      ? `${bestCraft.name} can profit per craft, but your current stack is worth more as a raw sale.`
      : `Current pricing does not beat the raw sale value of your ingredient stack.`;

  const comparisonValue = craftBeatsRaw
    ? `+${formatPrice(bestCraft.totalProfit - rawSellValue)} vs raw`
    : `Raw is better by ${formatPrice(Math.abs(rawSellValue - (bestCraft.totalProfit || 0)))}`;
  const mainProfitLabel = bestCraft.profitPerCraft > 0
    ? `${formatPrice(bestCraft.profitPerCraft)} profit per craft`
    : `${formatPrice(Math.abs(bestCraft.profitPerCraft))} loss per craft`;

  resultOutput.innerHTML = `
    <div class="result-summary result-summary--${recommendationTone}">
      <div class="result-head">
        <span class="result-badge">Best Option</span>
        <h3>${recommendationTitle}</h3>
        <p>${recommendationSummary}</p>
      </div>

      <div class="result-stats">
        ${renderStatCard("Raw Sale Value", formatPrice(rawSellValue), `${formatPrice(rawUnitPrice)} each`)}
        ${renderStatCard("Craft Target", bestCraft.name, `${bestCraft.maxCraftCount} craft${bestCraft.maxCraftCount === 1 ? "" : "s"} possible`, "primary")}
        ${renderStatCard("Per Craft", mainProfitLabel, `${formatPrice(bestCraft.totalProfit || 0)} total from available crafts`, "primary")}
        ${renderStatCard("Sell-Through", bestCraft.salesActivity.label, `${bestCraft.salesActivity.salesCount} recent sale${bestCraft.salesActivity.salesCount === 1 ? "" : "s"}`)}
        ${renderStatCard("Net Comparison", comparisonValue, craftBeatsRaw ? "Crafting wins" : "Raw selling wins", "primary")}
      </div>

      <div class="result-notes">
        <div class="result-note">
          <h4>Recommended Action</h4>
          <p>${craftBeatsRaw
            ? `Use about ${formatQuantity(bestCraft.inputQty)} ${ingredient}${bestCraft.inputQty === 1 ? "" : "s"} per craft path and sell ${bestCraft.name} instead of listing the raw material.`
            : rawStatement}</p>
        </div>
        <div class="result-note">
          <h4>Craft Economics</h4>
          <p>Each craft path into ${bestCraft.name} costs about ${formatPrice(bestCraft.totalCost)} and returns about ${formatPrice(bestCraft.grossRevenuePerCraft)} total for ${bestCraft.outputQty} item${bestCraft.outputQty === 1 ? "" : "s"}. ${bestCraft.profitPerCraft > 0
            ? `Estimated profit per craft: ${formatPrice(bestCraft.profitPerCraft)}.`
            : `Estimated loss per craft: ${formatPrice(Math.abs(bestCraft.profitPerCraft))}.`}</p>
        </div>
        <div class="result-note">
          <h4>Market Activity</h4>
          <p>${bestCraft.salesActivity.unitsSold} unit${bestCraft.salesActivity.unitsSold === 1 ? "" : "s"} sold across ${bestCraft.salesActivity.salesCount} recent sale${bestCraft.salesActivity.salesCount === 1 ? "" : "s"}${bestCraft.salesActivity.lastSoldRelative ? `, most recently ${bestCraft.salesActivity.lastSoldRelative}` : ""}. ${bestCraft.salesActivity.listingCount > 0 ? `Current listings: ${bestCraft.salesActivity.listingCount}.` : ""}</p>
        </div>
        <div class="result-note">
          <h4>Craft Chain</h4>
          <p>${bestCraft.chainSummary}</p>
        </div>
        ${alternativeCrafts.length > 0 ? `
          <div class="result-note">
            <h4>Other Good Options</h4>
            <div class="alternative-list">
              ${alternativeCrafts.map((option) => `
                <article class="alternative-card">
                  <strong>${option.name}</strong>
                  <span>${option.salesActivity.label}</span>
                  <p>${option.profitPerCraft > 0 ? `${formatPrice(option.profitPerCraft)} profit per craft` : `${formatPrice(Math.abs(option.profitPerCraft))} loss per craft`}. ${option.maxCraftCount} craft${option.maxCraftCount === 1 ? "" : "s"} possible.</p>
                </article>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function renderStatCard(label, value, subvalue = "", emphasis = "normal") {
  return `
    <article class="result-stat result-stat--${emphasis}">
      <span class="result-stat__label">${label}</span>
      <strong class="result-stat__value">${value}</strong>
      ${subvalue ? `<span class="result-stat__subvalue">${subvalue}</span>` : ""}
    </article>
  `;
}

function formatPrice(value) {
  const rounded = Number.isFinite(value) ? Math.round(value) : value;
  return `${rounded.toLocaleString()} gil`;
}

function formatQuantity(value) {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function loadIngredientNameCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_STORAGE_INGREDIENT_CACHE_KEY));
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

function saveIngredientNameCache(names) {
  try {
    localStorage.setItem(LOCAL_STORAGE_INGREDIENT_CACHE_KEY, JSON.stringify(names));
  } catch {
    // Ignore storage failures.
  }
}

function buildIngredientSearchIndex(names) {
  const index = new Map();
  names.forEach((name) => {
    const key = name.toLowerCase().slice(0, MIN_INGREDIENT_SEARCH_LENGTH);
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push(name);
  });
  return index;
}

async function getItemId(name) {
  const key = name.toLowerCase();
  if (itemIdLookupCache[key]) {
    return itemIdLookupCache[key];
  }

  if (!teamcraftItems) {
    teamcraftItems = await fetchTeamcraftItems();
  }

  const exactMatch = Object.entries(teamcraftItems).find(
    ([, entry]) => entry.en?.toLowerCase() === name.toLowerCase()
  );
  if (exactMatch) {
    itemIdLookupCache[key] = parseInt(exactMatch[0], 10);
    saveItemIdCache();
    return itemIdLookupCache[key];
  }

  try {
    const response = await fetch(`${XIVAPI_SEARCH_URL}${encodeURIComponent(name)}`);
    if (!response.ok) throw new Error("XIVAPI search failed");
    const json = await response.json();
    const item = (json.Results || []).find((entry) => entry.Name?.toLowerCase() === name.toLowerCase())
      || (json.Results || [])[0];
    if (item?.ID) {
      itemIdLookupCache[key] = item.ID;
      saveItemIdCache();
      return item.ID;
    }
  } catch (e) {
    // XIVAPI is unavailable, item not found in Teamcraft
  }

  return null;
}

async function fetchTeamcraftItems() {
  if (teamcraftItems) {
    return teamcraftItems;
  }

  const response = await fetch(TEAMCRAFT_ITEMS_URL);
  if (!response.ok) {
    throw new Error(`Unable to fetch Teamcraft items data from ${TEAMCRAFT_ITEMS_URL}`);
  }
  teamcraftItems = await response.json();
  return teamcraftItems;
}

async function loadTeamcraftRecipes() {
  if (teamcraftRecipes) {
    return teamcraftRecipes;
  }

  const items = await fetchTeamcraftItems();
  const rawRecipes = await fetchTeamcraftRecipes();

  teamcraftRecipes = rawRecipes
    .map((recipe) => {
      const outputName = items[recipe.result]?.en;
      if (!outputName) {
        return null;
      }

      const ingredients = Array.isArray(recipe.ingredients)
        ? recipe.ingredients
            .map((ingredient) => ({
              id: ingredient.id,
              qty: ingredient.amount ?? 1,
              name: items[ingredient.id]?.en,
            }))
            .filter((ingredient) => ingredient.name)
        : [];

      if (ingredients.length === 0) {
        return null;
      }

      return {
        outputId: recipe.result,
        name: outputName,
        outputQty: recipe.yields || 1,
        ingredients,
      };
    })
    .filter(Boolean);

  return teamcraftRecipes;
}

function collectCandidateRecipes(rootIngredient, allRecipes) {
  const recipesByIngredient = buildRecipesByIngredientMap(allRecipes);
  const candidates = [];
  const seenOutputs = new Set();

  function visit(ingredientName, depth, path) {
    if (depth > MAX_CRAFT_CHAIN_DEPTH) {
      return;
    }

    const recipes = recipesByIngredient.get(ingredientName.toLowerCase()) || [];
    recipes.forEach((recipe) => {
      const outputKey = `${recipe.name}:${depth}`;
      if (!seenOutputs.has(outputKey)) {
        candidates.push(recipe);
        seenOutputs.add(outputKey);
      }

      if (!path.has(recipe.name)) {
        const nextPath = new Set(path);
        nextPath.add(recipe.name);
        visit(recipe.name, depth + 1, nextPath);
      }
    });
  }

  visit(rootIngredient, 1, new Set([rootIngredient]));
  return candidates;
}

function buildCraftPlans(rootIngredient, candidateRecipes, allRecipes) {
  const recipesByOutput = buildRecipesByOutputMap(allRecipes);
  const planCache = new Map();

  return candidateRecipes
    .map((recipe) => buildPlanForRecipe(recipe, rootIngredient, recipesByOutput, planCache, new Set()))
    .filter(Boolean)
    .filter((plan, index, plans) => plans.findIndex((entry) => entry.name === plan.name) === index);
}

function buildPlanForRecipe(recipe, rootIngredient, recipesByOutput, planCache, path) {
  const cacheKey = `${rootIngredient}:${recipe.name}`;
  if (planCache.has(cacheKey)) {
    return planCache.get(cacheKey);
  }

  if (path.has(recipe.name)) {
    return null;
  }

  const nextPath = new Set(path);
  nextPath.add(recipe.name);

  const requirements = {};
  const chainOutputs = [];
  let usesRootIngredient = false;

  recipe.ingredients.forEach((ingredient) => {
    if (ingredient.name.toLowerCase() === rootIngredient.toLowerCase()) {
      addRequirement(requirements, ingredient.name, ingredient.qty);
      usesRootIngredient = true;
      return;
    }

    const childRecipes = recipesByOutput.get(ingredient.name.toLowerCase()) || [];
    let chosenChildPlan = null;

    childRecipes.forEach((childRecipe) => {
      if (nextPath.has(childRecipe.name)) {
        return;
      }

      const childPlan = buildPlanForRecipe(childRecipe, rootIngredient, recipesByOutput, planCache, nextPath);
      if (!childPlan || childPlan.rootIngredientQty <= 0) {
        return;
      }

      if (!chosenChildPlan || (childPlan.rootIngredientQty / childPlan.outputQty) > (chosenChildPlan.rootIngredientQty / chosenChildPlan.outputQty)) {
        chosenChildPlan = childPlan;
      }
    });

    if (chosenChildPlan) {
      const scale = ingredient.qty / chosenChildPlan.outputQty;
      Object.entries(chosenChildPlan.requirements).forEach(([name, qty]) => {
        addRequirement(requirements, name, qty * scale);
      });
      chainOutputs.push(...chosenChildPlan.chainOutputs);
      usesRootIngredient = true;
      return;
    }

    addRequirement(requirements, ingredient.name, ingredient.qty);
  });

  if (!usesRootIngredient) {
    planCache.set(cacheKey, null);
    return null;
  }

  const uniqueChainOutputs = Array.from(new Set(chainOutputs.filter((name) => name !== rootIngredient)));
  const plan = {
    ...recipe,
    requirements,
    rootIngredientQty: requirements[rootIngredient] || requirements[findRequirementKey(requirements, rootIngredient)] || 0,
    chainOutputs: [...uniqueChainOutputs, recipe.name],
    chainSummary: [rootIngredient, ...uniqueChainOutputs, recipe.name].join(" -> "),
  };

  planCache.set(cacheKey, plan);
  return plan;
}

function buildRecipesByIngredientMap(recipes) {
  const map = new Map();
  recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
      const key = ingredient.name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(recipe);
    });
  });
  return map;
}

function buildRecipesByOutputMap(recipes) {
  const map = new Map();
  recipes.forEach((recipe) => {
    const key = recipe.name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(recipe);
  });
  return map;
}

function addRequirement(requirements, name, qty) {
  requirements[name] = (requirements[name] || 0) + qty;
}

function findRequirementKey(requirements, name) {
  return Object.keys(requirements).find((entry) => entry.toLowerCase() === name.toLowerCase());
}

async function fetchTeamcraftRecipes() {
  const response = await fetch(TEAMCRAFT_RECIPES_URL);
  if (!response.ok) {
    throw new Error(`Unable to fetch Teamcraft recipe data from ${TEAMCRAFT_RECIPES_URL}`);
  }
  return response.json();
}

async function normalizeItemName(name) {
  if (!teamcraftItems) {
    await fetchTeamcraftItems();
  }

  const match = Object.values(teamcraftItems).find(
    (item) => item.en?.toLowerCase() === name.toLowerCase()
  );
  return match?.en || name;
}

function loadItemIdCache() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_IDS_CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveItemIdCache() {
  try {
    localStorage.setItem(LOCAL_STORAGE_IDS_CACHE_KEY, JSON.stringify(itemIdLookupCache));
  } catch {
    // Ignore storage failures.
  }
}

function initializeDropdowns() {
  const sortedDatacenters = [...SUPPORTED_DATACENTERS].sort(compareNames);
  datacenterSelect.innerHTML = "";

  sortedDatacenters.forEach((datacenter) => {
    const option = document.createElement("option");
    option.value = datacenter;
    option.textContent = datacenter;
    datacenterSelect.appendChild(option);
  });

  const preferredDatacenter = sortedDatacenters.includes(savedPreferences.datacenter)
    ? savedPreferences.datacenter
    : (sortedDatacenters.includes("Aether") ? "Aether" : sortedDatacenters[0]);
  datacenterSelect.value = preferredDatacenter;

  datacenterSelect.addEventListener("change", () => {
    populateServerOptions(datacenterSelect.value);
    savePreferences();
  });

  serverSelect.addEventListener("change", () => {
    savePreferences();
  });

  populateServerOptions(datacenterSelect.value, savedPreferences.server);
}

function populateServerOptions(datacenter, preferredServer = "") {
  const worlds = [...(DATACENTER_WORLDS[datacenter] || [])].sort(compareNames);
  serverSelect.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "All worlds in datacenter";
  serverSelect.appendChild(defaultOption);

  worlds.forEach((world) => {
    const option = document.createElement("option");
    option.value = world;
    option.textContent = world;
    serverSelect.appendChild(option);
  });

  serverSelect.value = worlds.includes(preferredServer) ? preferredServer : "";
}

function compareNames(left, right) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function loadPreferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PREFERENCES_KEY)) || {};
    return {
      datacenter: typeof parsed.datacenter === "string" ? parsed.datacenter : "",
      server: typeof parsed.server === "string" ? parsed.server : "",
    };
  } catch {
    return { datacenter: "", server: "" };
  }
}

function savePreferences() {
  try {
    localStorage.setItem(LOCAL_STORAGE_PREFERENCES_KEY, JSON.stringify({
      datacenter: datacenterSelect.value,
      server: serverSelect.value,
    }));
  } catch {
    // Ignore storage failures.
  }
}

function createEmptySalesActivity() {
  return {
    hasRecentSales: false,
    salesCount: 0,
    unitsSold: 0,
    listingCount: 0,
    lastSoldAt: null,
    lastSoldRelative: "",
    label: "No recent sales found",
  };
}

function scoreSalesActivity(activity) {
  if (!activity.hasRecentSales) {
    return 0;
  }

  const lastSaleBoost = activity.hoursSinceLastSale <= 24 ? 4
    : activity.hoursSinceLastSale <= 72 ? 3
      : activity.hoursSinceLastSale <= 168 ? 2
        : 1;
  const volumeBoost = Math.min(activity.salesCount, 8) + Math.min(activity.unitsSold / 2, 8);
  const competitionPenalty = activity.listingCount > activity.unitsSold ? 2 : 0;
  return Math.max(0, lastSaleBoost + volumeBoost - competitionPenalty);
}

function scoreCraftOption(option, rawSellValue) {
  const profitScore = (option.totalProfit ?? Number.NEGATIVE_INFINITY) - rawSellValue;
  return profitScore + (option.salesScore * 500);
}

async function fetchCraftSalesActivity(scope, candidateRecipes, itemIdsByName) {
  const uniqueOutputNames = [...new Set(candidateRecipes.map((recipe) => recipe.name))];
  const activityEntries = await Promise.all(uniqueOutputNames.map(async (name) => {
    const itemId = itemIdsByName[name];
    if (!itemId) {
      return [name, createEmptySalesActivity()];
    }

    try {
      const response = await fetch(`${UNIVERSALIS_BASE_URL}/${encodeURIComponent(scope)}/${itemId}?entries=${RECENT_HISTORY_SAMPLE_SIZE}`);
      if (!response.ok) {
        throw new Error(`Universalis activity request failed for ${name}`);
      }

      const json = await response.json();
      return [name, summarizeSalesActivity(json)];
    } catch (error) {
      console.warn("Could not load craft sales activity:", name, error);
      return [name, createEmptySalesActivity()];
    }
  }));

  return Object.fromEntries(activityEntries);
}

function summarizeSalesActivity(marketData) {
  const sales = Array.isArray(marketData?.recentHistory) ? marketData.recentHistory : [];
  const listingCount = Array.isArray(marketData?.listings)
    ? marketData.listings.length
    : Number(marketData?.listingsCount) || 0;

  if (sales.length === 0) {
    return createEmptySalesActivity();
  }

  const salesCount = sales.length;
  const unitsSold = sales.reduce((sum, sale) => sum + (Number(sale.quantity) || 0), 0);
  const lastSoldAt = sales.reduce((latest, sale) => Math.max(latest, Number(sale.timestamp) || 0), 0) || null;
  const lastSoldRelative = lastSoldAt ? formatRelativeTimeFromUnix(lastSoldAt) : "";
  const hoursSinceLastSale = lastSoldAt ? (Date.now() - (lastSoldAt * 1000)) / (1000 * 60 * 60) : Infinity;
  const label = getSalesActivityLabel({ salesCount, unitsSold, lastSoldAt, listingCount });

  return {
    hasRecentSales: true,
    salesCount,
    unitsSold,
    listingCount,
    lastSoldAt,
    lastSoldRelative,
    hoursSinceLastSale,
    label,
  };
}

function getSalesActivityLabel({ salesCount, unitsSold, lastSoldAt, listingCount }) {
  const hoursSinceLastSale = lastSoldAt ? (Date.now() - (lastSoldAt * 1000)) / (1000 * 60 * 60) : Infinity;

  if (salesCount >= 10 && unitsSold >= 20 && hoursSinceLastSale <= 24) {
    return "Sells very well";
  }

  if (salesCount >= 5 && unitsSold >= 8 && hoursSinceLastSale <= 72) {
    return "Sells well";
  }

  if (salesCount >= 2 && hoursSinceLastSale <= 168) {
    return listingCount > unitsSold ? "Moderate demand, more competition" : "Moderate demand";
  }

  return "Slow seller";
}

function formatRelativeTimeFromUnix(unixSeconds) {
  const elapsedMs = Date.now() - (unixSeconds * 1000);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return "";
  }

  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  if (hours < 1) {
    return "less than an hour ago";
  }
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

async function fetchMarketPrices(scope, itemIdsByName) {
  const itemIds = Object.values(itemIdsByName);
  const url = `${UNIVERSALIS_BASE_URL}/aggregated/${encodeURIComponent(scope)}/${itemIds.join(",")}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch market prices from Universalis for ${scope}.`);
  }

  const json = await response.json();
  const results = json.results || [];
  const priceById = {};

  for (const result of results) {
    const price = getAggregatedPrice(result);
    if (price != null) {
      priceById[result.itemId] = price;
    }
  }

  const pricesByName = {};
  for (const [name, itemId] of Object.entries(itemIdsByName)) {
    pricesByName[name] = priceById[itemId] ?? null;
  }
  return pricesByName;
}

function getAggregatedPrice(result) {
  return (
    result?.nq?.minListing?.world?.price ??
    result?.nq?.minListing?.dc?.price ??
    result?.nq?.averageSalePrice?.world?.price ??
    result?.nq?.averageSalePrice?.dc?.price ??
    result?.nq?.medianListing?.world?.price ??
    result?.nq?.medianListing?.dc?.price ??
    result?.hq?.minListing?.world?.price ??
    result?.hq?.minListing?.dc?.price ??
    result?.hq?.averageSalePrice?.world?.price ??
    result?.hq?.averageSalePrice?.dc?.price ??
    result?.hq?.medianListing?.world?.price ??
    result?.hq?.medianListing?.dc?.price ??
    null
  );
}
