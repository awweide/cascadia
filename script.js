const FULL_TURNS = 20;
const HEX_SIZE = 54;

const terrains = ["forest", "river", "mountain", "prairie", "wetland"];
const animals = ["🐻", "🦌", "🐟", "🦅", "🦊"];
const terrainColors = {
  forest: "#83a07f",
  river: "#7ca3c5",
  mountain: "#a6a09d",
  prairie: "#f7efc3",
  wetland: "#d5f1e2",
};

const terrainNames = {
  forest: "Forest",
  river: "River",
  mountain: "Mountain",
  prairie: "Prairie",
  wetland: "Wetland",
};

const animalNames = {
  "🦌": "Elk",
  "🦊": "Fox",
  "🐻": "Bear",
  "🦅": "Hawk",
  "🐟": "Salmon",
};

const defaultScoringCards = {
  "🐻": "A",
  "🦌": "A",
  "🐟": "A",
  "🦅": "A",
  "🦊": "A",
};

const scoringCardRules = {
  "🐻": {
    A: "Mating pairs: Score 4 11 19 27 points for 1 2 3 4+ connected groups of exactly two bears.",
    B: "Mother and cubs: Score 10 points for each connected group of exactly three bears.",
    C: "Families: Score 2 5 8 points for each connected group of exactly 1 2 3 bears. Score an additional 3 points for having at least one group of each size.",
    D: "Big groups: Score 5 8 13 points for each connected group of exactly 2 3 4 bears.",
  },
  "🦌": {
    A: "Lines: Score 2 5 9 13 for each connected, straight line of 1 2 3 4 elks. Each elk can only be part of one line.",
    B: "Formations: Score 2 5 9 13 for each connected group of 1 2 3 (triangle only) 4 (diamond only) elks. Each elk can only be part of one group.",
    C: "Herds: Score 2 4 7 10 14 18 23 28 points for each connected group of 1 2 3 4 5 6 7 8+ elks.",
    D: "Rings: Score 2 5 8 12 16 21 points for each ring of 1 2 3 4 5 6 elks around the same central hex.",
  },
  "🐟": {
    A: "Long run: Score 2 5 8 12 16 20 25 points for each run of 1 2 3 4 5 6 7+ salmon.",
    B: "Short run: Score 2 4 9 11 17 points for each run of 1 2 3 4 5+ salmon.",
    C: "Families: Score 10 12 15 points for each run of 3 4 5+ salmon.",
    D: "Surrounded: For each run of at least 3 salmon, score 1 point per salmon plus 1 point per adjacent animal (without double counting adjacent animals).",
  },
  "🦅": {
    A: "Solitary: Score 2 5 8 11 14 18 22 26 points for 1 2 3 4 5 6 7 8+ hawks not adjacent to any other hawk.",
    B: "Connected: Score 5 9 12 16 20 24 28 points for 2 3 4 5 6 7 8+ hawks that are non-adjacent and have line of sight to another hawk.",
    C: "Network: Score 3 points for each line of sight between hawks.",
    D: "Territorial: Score 4 7 9 points for each pair of hawks with line of sight and with 1 2 3 unique species in between. Each hawk can only be part of one pair.",
  },
  "🦊": {
    A: "Nearby animals: For each fox, score 1 2 3 4 5 points for 1 2 3 4 5 different species adjacent to it. Foxes count.",
    B: "Nearby pairs: For each fox, score 3 5 7 points for 1 2 3 different species with at least two animals adjacent to it. Foxes do not count.",
    C: "Nearby related: For each fox, score 1 2 3 4 5 6 points for 1 2 3 4 5 6 animals of a single species adjacent to it. Foxes do not count.",
    D: "Dynamic duos: For each connected group of exactly two foxes, score 5 7 9 11 points for 1 2 3 4 different species with at least 2 animals adjacent to the pair. Foxes do not count.",
  },
};

function createDataFromLegacyFormat() {
  const habitatMap = {
    forest: "forest",
    mountain: "mountain",
    desert: "prairie",
    swamp: "wetland",
    lake: "river",
  };
  const wildlifeMap = {
    bear: "🐻",
    elk: "🦌",
    salmon: "🐟",
    hawk: "🦅",
    fox: "🦊",
  };

  const normalizeWildlife = (wildlife = []) => wildlife.map((animal) => wildlifeMap[animal] ?? animal);
  const toRotationSteps = (rotationValue = 0) => {
    if (Number.isNaN(Number(rotationValue))) return 0;
    return Math.round(Number(rotationValue) / 60);
  };

  const convertTile = (legacyTile, idPrefix) => {
    const mappedHabitats = (legacyTile.habitats ?? []).map((habitat) => habitatMap[habitat] ?? habitat);
    const printedAnimals = normalizeWildlife(legacyTile.wildlife ?? []);
    const tileNum = legacyTile.tileNum ?? "x";

    if (mappedHabitats.length <= 1) {
      return {
        kind: "single",
        terrain: mappedHabitats[0],
        printedAnimals,
        bonusOnToken: true,
        marketType: "single-single",
        id: `${idPrefix}-${tileNum}`,
      };
    }

    return {
      kind: "split",
      terrainA: mappedHabitats[0],
      terrainB: mappedHabitats[1],
      printedAnimals,
      bonusOnToken: false,
      marketType: null,
      id: `${idPrefix}-${tileNum}`,
    };
  };

  const starterSets = Array.isArray(window.startingTiles) ? window.startingTiles : [];
  const starterCoords = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
  ];

  const starterTileSets = starterSets.map((starterSet, setIndex) =>
    starterSet.map((starterTile, index) => {
      const coord = starterCoords[index] ?? { q: index, r: 0 };
      return {
        q: coord.q,
        r: coord.r,
        rotation: toRotationSteps(starterTile.rotation),
        tile: convertTile(starterTile, `starter-${setIndex}`),
        token: null,
      };
    })
  );

  const tileBag = (Array.isArray(window.tiles) ? window.tiles : []).map((tile) => convertTile(tile, "tile"));

  return {
    starterTileSets,
    starterTiles: starterTileSets[0] ?? [],
    tileBag,
  };
}

const CASCADIA_SOURCE_DATA = window.CASCADIA_DATA ?? createDataFromLegacyFormat();

const TILE_REFERENCE_LIST = (CASCADIA_SOURCE_DATA.tileBag ?? []).map((tile) => ({ ...tile, printedAnimals: [...tile.printedAnimals] }));
const STARTER_TILE_SETS = (
  CASCADIA_SOURCE_DATA.starterTileSets
  ?? (CASCADIA_SOURCE_DATA.starterTiles ? [CASCADIA_SOURCE_DATA.starterTiles] : [])
).map((starterSet) => starterSet.map((starter) => ({
  ...starter,
  tile: { ...starter.tile, printedAnimals: [...starter.tile.printedAnimals] },
})));

// Edge indices are ordered clockwise as: NE, E, SE, SW, W, NW.
const axialDirections = [
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
];

const state = {
  tiles: new Map(),
  market: [],
  selectedPairIndex: null,
  selectedPair: null,
  pendingRotation: 0,
  turn: 1,
  maxTurns: FULL_TURNS,
  phase: "pickPair",
  gameOver: false,
  score: null,
  hoverCoordKey: null,
  boardLayout: {
    minX: 0,
    minY: 0,
    padding: HEX_SIZE * 2.5,
    openKeys: new Set(),
  },
  turnStartSnapshot: null,
  pendingDiscardReason: null,
  natureTokens: 0,
  useNatureForMixedPair: false,
  mixedSelection: { tileIndex: null, tokenIndex: null },
  eventLog: [],
  statusMessage: "",
  tileBag: [],
  animalBag: [],
  pendingAnimalReturns: [],
};

const turnCounterEl = document.getElementById("turn-counter");
const starCounterEl = document.getElementById("star-counter");
const scoreFormulaEl = document.getElementById("score-formula");
const scoreBreakdownEl = document.getElementById("score-breakdown");
const marketTilesEl = document.getElementById("market-tiles");
const boardEl = document.getElementById("board");
const restartBtn = document.getElementById("restart-btn");
const rotateLeftBtn = document.getElementById("rotate-left-btn");
const rotateRightBtn = document.getElementById("rotate-right-btn");
const toggleSplitPickBtn = document.getElementById("toggle-split-pick-btn");
const rerollSelectedTokensBtn = document.getElementById("reroll-selected-tokens-btn");
const rerollTripleBtn = document.getElementById("reroll-triple-btn");
const resetTurnBtn = document.getElementById("reset-turn-btn");
const confirmDiscardBtn = document.getElementById("confirm-discard-btn");
const eventLogEl = document.getElementById("event-log");
const floatingStatusTextEl = document.getElementById("floating-status-text");
const setupScreenEl = document.getElementById("setup-screen");
const gameScreenEl = document.getElementById("game-screen");
const setupStartingTileEl = document.getElementById("setup-starting-tile");
const setupCardBearEl = document.getElementById("setup-card-bear");
const setupCardElkEl = document.getElementById("setup-card-elk");
const setupCardSalmonEl = document.getElementById("setup-card-salmon");
const setupCardHawkEl = document.getElementById("setup-card-hawk");
const setupCardFoxEl = document.getElementById("setup-card-fox");
const startGameBtn = document.getElementById("start-game-btn");


if (TILE_REFERENCE_LIST.length === 0 || STARTER_TILE_SETS.length === 0) {
  throw new Error("Tile data is missing. Ensure data.js is loaded before script.js.");
}

state.gameSetup = {
  starterSetIndex: 0,
  scoringCards: { ...defaultScoringCards },
};

function key(q, r) {
  return `${q},${r}`;
}

function parseKey(coordKey) {
  const [q, r] = coordKey.split(",").map(Number);
  return { q, r };
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffleInPlace(list) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
}

function drawDraftTile() {
  if (state.tileBag.length === 0) return null;
  return state.tileBag.pop();
}

function drawAnimalToken() {
  if (state.animalBag.length === 0) return randomItem(animals);
  return state.animalBag.pop();
}

function drawPair() {
  const tileDraft = drawDraftTile();
  if (!tileDraft) return null;
  return {
    tileDraft,
    token: drawAnimalToken(),
  };
}

function randomCardLetter() {
  return randomItem(["A", "B", "C", "D"]);
}

function selectWithRandom(value, maxExclusive) {
  if (value === "random") return Math.floor(Math.random() * maxExclusive);
  const parsed = Number.parseInt(value, 10);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed < maxExclusive) return parsed;
  return 0;
}

function tileFromDraft(tileDraft, rotationSteps) {
  const rotation = ((rotationSteps % 6) + 6) % 6;

  if (tileDraft.kind === "single") {
    return {
      kind: "single",
      terrain: tileDraft.terrain,
      printedAnimals: [...tileDraft.printedAnimals],
      token: null,
      starter: false,
      rotation,
      terrainsPresent: [tileDraft.terrain],
      edges: Array(6).fill(tileDraft.terrain),
      bonusOnToken: Boolean(tileDraft.bonusOnToken),
      marketType: tileDraft.marketType ?? null,
    };
  }

  const baseEdges = [
    tileDraft.terrainA,
    tileDraft.terrainA,
    tileDraft.terrainA,
    tileDraft.terrainB,
    tileDraft.terrainB,
    tileDraft.terrainB,
  ];
  const edges = Array(6).fill(null);
  for (let edge = 0; edge < 6; edge += 1) {
    edges[(edge + rotation) % 6] = baseEdges[edge];
  }

  return {
    kind: "split",
    terrainA: tileDraft.terrainA,
    terrainB: tileDraft.terrainB,
    printedAnimals: [...tileDraft.printedAnimals],
    token: null,
    starter: false,
    rotation,
    terrainsPresent: [tileDraft.terrainA, tileDraft.terrainB],
    edges,
    bonusOnToken: false,
    marketType: tileDraft.marketType ?? null,
  };
}

function refillMarketToFour() {
  while (state.market.length < 4) {
    const pair = drawPair();
    if (!pair) break;
    state.market.push(pair);
  }
}

function neighboringKeys(q, r) {
  return axialDirections.map(([dq, dr]) => key(q + dq, r + dr));
}

function openPlacementKeys() {
  const open = new Set();
  for (const coordKey of state.tiles.keys()) {
    const { q, r } = parseKey(coordKey);
    neighboringKeys(q, r).forEach((neighborKey) => {
      if (!state.tiles.has(neighborKey)) open.add(neighborKey);
    });
  }
  return Array.from(open);
}

function selectedStarterTileSet() {
  const idx = state.gameSetup?.starterSetIndex ?? 0;
  return STARTER_TILE_SETS[idx] ?? STARTER_TILE_SETS[0] ?? [];
}

function placeStarterTriangle() {
  selectedStarterTileSet().forEach((starter) => {
    const built = tileFromDraft(starter.tile, starter.rotation);
    built.starter = true;
    built.token = starter.token;
    state.tiles.set(key(starter.q, starter.r), built);
  });
}

function canPlaceTokenAnywhere(tokenAnimal) {
  for (const tile of state.tiles.values()) {
    if (!tile.token && tile.printedAnimals.includes(tokenAnimal)) return true;
  }
  return false;
}

function removePickedMarketPair(chosenPair) {
  if (!chosenPair) return null;

  if (chosenPair.isMixedPair && chosenPair.tileIndex !== chosenPair.tokenIndex) {
    const maxIndex = Math.max(chosenPair.tileIndex, chosenPair.tokenIndex);
    const minIndex = Math.min(chosenPair.tileIndex, chosenPair.tokenIndex);
    const removedA = state.market.splice(maxIndex, 1)[0] ?? null;
    const removedB = state.market.splice(minIndex, 1)[0] ?? null;
    return [removedA, removedB];
  }

  const index = chosenPair.tileIndex ?? state.selectedPairIndex;
  if (index === null || index < 0 || index >= state.market.length) return null;
  const [removed] = state.market.splice(index, 1);
  return removed;
}

function removeLeftmostMarketPair() {
  if (state.market.length === 0) return null;
  const [removed] = state.market.splice(0, 1);
  return removed;
}

function setStatus(message) {
  state.statusMessage = message;
}

function floatingStatusText() {
  if (state.gameOver) return state.statusMessage;
  return `Turn ${Math.min(state.turn, state.maxTurns)}/${state.maxTurns}: ${state.statusMessage}`;
}

function addEventLog(message) {
  const turnLabel = state.gameOver ? "Game Over" : `Turn ${state.turn}`;
  state.eventLog.push(`[${turnLabel}] ${message}`);
}

function renderEventLog() {
  eventLogEl.innerHTML = state.eventLog
    .map((entry) => `<p class="event-entry">${entry}</p>`)
    .join("");
  eventLogEl.scrollTop = eventLogEl.scrollHeight;
}

function countMarketTokenKinds() {
  const counts = new Map();
  state.market.forEach((pair) => {
    counts.set(pair.token, (counts.get(pair.token) ?? 0) + 1);
  });
  return counts;
}

function replaceTokenAtIndex(index) {
  if (index < 0 || index >= state.market.length) return;
  const oldToken = state.market[index].token;
  state.pendingAnimalReturns.push(oldToken);
  state.market[index].token = drawAnimalToken();
  addEventLog(`Market token ${oldToken} at slot ${index + 1} rerolled to ${state.market[index].token}.`);
}

function returnPendingAnimalTokensToBag() {
  if (state.pendingAnimalReturns.length === 0) return;
  state.pendingAnimalReturns.forEach((animal) => state.animalBag.push(animal));
  shuffleInPlace(state.animalBag);
  addEventLog(`Returned ${state.pendingAnimalReturns.length} refreshed token(s) to the animal bag at end of turn.`);
  state.pendingAnimalReturns = [];
}

function forceMarketQuadRefresh() {
  const counts = countMarketTokenKinds();
  for (const [animal, count] of counts.entries()) {
    if (count >= 4) {
      const affected = [];
      state.market.forEach((pair, index) => {
        if (pair.token === animal) affected.push(index);
      });
      affected.forEach((index) => replaceTokenAtIndex(index));
      addEventLog(`Four ${animal} tokens appeared, so all were automatically discarded and replaced.`);
      return true;
    }
  }
  return false;
}

function availableTripleTokenAnimal() {
  const counts = countMarketTokenKinds();
  for (const [animal, count] of counts.entries()) {
    if (count === 3) return animal;
  }
  return null;
}

function performOptionalTripleRefresh() {
  const animal = availableTripleTokenAnimal();
  if (!animal) return false;

  const affected = [];
  state.market.forEach((pair, index) => {
    if (pair.token === animal) affected.push(index);
  });
  affected.forEach((index) => replaceTokenAtIndex(index));
  addEventLog(`Player chose to refresh triple ${animal} market tokens.`);
  return true;
}

function parseRefreshSelection(input) {
  if (!input) return null;
  const selected = input
    .split(/[\s,]+/)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 4)
    .map((value) => value - 1);
  return Array.from(new Set(selected));
}

function spendNatureToken(reason) {
  if (state.natureTokens <= 0) return false;
  state.natureTokens -= 1;
  addEventLog(`Spent 1 star (${reason}).`);
  return true;
}


function axialToPixel(q, r) {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
  const y = HEX_SIZE * 1.5 * r;
  return { x, y };
}

function tileBackground(tile) {
  if (tile.kind === "single") {
    return terrainColors[tile.terrain];
  }

  const angle = tile.rotation * 60;
  const cA = terrainColors[tile.terrainA];
  const cB = terrainColors[tile.terrainB];
  return `conic-gradient(from ${angle}deg, ${cA} 0deg 180deg, ${cB} 180deg 360deg)`;
}

function darkenHexColor(colorHex, factor = 0.38) {
  const hex = colorHex.replace("#", "");
  const parse = (start) => Number.parseInt(hex.slice(start, start + 2), 16);
  const toHex = (value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
  const r = Math.round(parse(0) * (1 - factor));
  const g = Math.round(parse(2) * (1 - factor));
  const b = Math.round(parse(4) * (1 - factor));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function starColorForTile(tile) {
  const terrain = tile.kind === "single" ? tile.terrain : tile.terrainA;
  const baseColor = terrainColors[terrain] ?? "#8a6f2a";
  const factor = terrain === "mountain" ? 0.5 : 0.38;
  return darkenHexColor(baseColor, factor);
}

function hexTileCenterMarkup(tile, tokenOverride = null) {
  const tokenText = tokenOverride ?? tile.token;
  const starColor = starColorForTile(tile);
  const starMarkup = tile.bonusOnToken ? `<span class="hex-star" style="color:${starColor};">★</span>` : "";
  const printedMarkup = tokenText ? "" : printedAnimalsMarkup(tile.printedAnimals);
  const tokenMarkup = tokenText ? `<span class="hex-token">${tokenText}</span>` : "";
  return `<span class="hex-center">${starMarkup}${printedMarkup}${tokenMarkup}</span>`;
}

function eligibleTokenPlacementKeys() {
  if (state.phase !== "placeToken" || !state.selectedPair) return new Set();

  const eligible = new Set();
  for (const [coordKey, tile] of state.tiles.entries()) {
    if (!tile.token && tile.printedAnimals.includes(state.selectedPair.token)) eligible.add(coordKey);
  }
  return eligible;
}

function renderBoard() {
  boardEl.innerHTML = "";

  const allCoords = [];
  for (const coordKey of state.tiles.keys()) allCoords.push(parseKey(coordKey));
  openPlacementKeys().forEach((coordKey) => allCoords.push(parseKey(coordKey)));

  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;

  allCoords.forEach(({ q, r }) => {
    const { x, y } = axialToPixel(q, r);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  const padding = HEX_SIZE * 2.5;
  boardEl.style.width = `${Math.max(500, maxX - minX + padding * 2)}px`;
  boardEl.style.height = `${Math.max(380, maxY - minY + padding * 2 + HEX_SIZE)}px`;

  const openKeys = new Set(openPlacementKeys());
  const tokenEligibleKeys = eligibleTokenPlacementKeys();
  state.boardLayout = { minX, minY, padding, openKeys };

  function drawHex(q, r, tile, isOpen) {
    const hex = document.createElement("button");
    hex.type = "button";
    hex.className = "hex";
    const { x, y } = axialToPixel(q, r);
    hex.style.left = `${x - minX + padding}px`;
    hex.style.top = `${y - minY + padding}px`;
    hex.dataset.q = String(q);
    hex.dataset.r = String(r);

    const coordKey = key(q, r);

    if (isOpen) {
      if (state.phase === "placeTile" && state.selectedPair && state.hoverCoordKey === coordKey) {
        const previewTile = tileFromDraft(state.selectedPair.tileDraft, state.pendingRotation);
        hex.classList.add("preview");
        hex.style.background = tileBackground(previewTile);
        hex.innerHTML = printedAnimalsMarkup(previewTile.printedAnimals);
      } else {
        hex.classList.add("open");
        hex.textContent = "+";
      }
    } else {
      hex.classList.add("filled");
      if (tile.starter) hex.classList.add("starter");
      if (tile.bonusOnToken) hex.classList.add("bonus-tile");
      hex.style.background = tileBackground(tile);

      if (state.phase === "placeToken" && state.selectedPair) {
        if (tokenEligibleKeys.has(coordKey)) hex.classList.add("token-eligible");
        else hex.classList.add("token-ineligible");
      }

      const showTokenPreview = state.hoverCoordKey === coordKey && hoverTokenIsLegal(coordKey);
      if (showTokenPreview) {
        hex.classList.add("token-preview");
        hex.innerHTML = hexTileCenterMarkup(tile, state.selectedPair.token);
      } else {
        hex.innerHTML = hexTileCenterMarkup(tile);
      }

      if (tile.kind === "single") {
        const starText = tile.bonusOnToken ? " | star available" : "";
        hex.title = `${tile.terrain} | printed: ${tile.printedAnimals.join(", ")} | token: ${tile.token ?? "none"}${starText}`;
      } else {
        hex.title = `${tile.terrainA}/${tile.terrainB} (rot ${tile.rotation * 60}°) | printed: ${tile.printedAnimals.join(", ")} | token: ${tile.token ?? "none"}`;
      }
    }

    hex.addEventListener("click", onBoardHexClick);
    boardEl.appendChild(hex);
  }

  for (const [coordKey, tile] of state.tiles.entries()) {
    const { q, r } = parseKey(coordKey);
    drawHex(q, r, tile, false);
  }

  openKeys.forEach((coordKey) => {
    const { q, r } = parseKey(coordKey);
    drawHex(q, r, null, true);
  });
}


function printedAnimalsMarkup(printedAnimals) {
  if (printedAnimals.length !== 3) {
    return `<span class="hex-animals token-count-${printedAnimals.length}">${printedAnimals.join(" ")}</span>`;
  }

  return `
    <span class="hex-animals token-count-3" aria-label="${printedAnimals.join(" ")}">
      <span class="token-top">${printedAnimals[0]}</span>
      <span class="token-bottom">${printedAnimals[1]} ${printedAnimals[2]}</span>
    </span>
  `;
}

function marketTileHexHTML(pair) {
  const tile = tileFromDraft(pair.tileDraft, 0);
  const bg = tileBackground(tile);
  return `<div class="hex market-hex" style="background:${bg};">${hexTileCenterMarkup(tile)}</div>`;
}

function clearMixedSelection() {
  state.mixedSelection.tileIndex = null;
  state.mixedSelection.tokenIndex = null;
}

function currentChosenPair() {
  if (state.useNatureForMixedPair) {
    const tileIndex = state.mixedSelection.tileIndex;
    const tokenIndex = state.mixedSelection.tokenIndex;
    if (tileIndex === null || tokenIndex === null) return null;
    return {
      tileDraft: state.market[tileIndex].tileDraft,
      token: state.market[tokenIndex].token,
      tileIndex,
      tokenIndex,
      isMixedPair: tileIndex !== tokenIndex,
    };
  }

  if (state.selectedPairIndex === null) return null;
  const pair = state.market[state.selectedPairIndex];
  if (!pair) return null;
  return {
    tileDraft: pair.tileDraft,
    token: pair.token,
    tileIndex: state.selectedPairIndex,
    tokenIndex: state.selectedPairIndex,
    isMixedPair: false,
  };
}

function renderMarket() {
  marketTilesEl.innerHTML = "";
  state.market.forEach((pair, index) => {
    const pairEl = document.createElement("button");
    pairEl.type = "button";
    pairEl.className = "pair";

    if (!state.useNatureForMixedPair && state.selectedPairIndex === index) pairEl.classList.add("selected");
    if (state.useNatureForMixedPair && state.mixedSelection.tileIndex === index) pairEl.classList.add("selected-tile");
    if (state.useNatureForMixedPair && state.mixedSelection.tokenIndex === index) pairEl.classList.add("selected-token");

    pairEl.innerHTML = `
      <div class="market-tile-row">${marketTileHexHTML(pair)}</div>
      <div class="market-token-row token-row">
        <span class="market-token pick">${pair.token}</span>
      </div>
    `;

    pairEl.addEventListener("click", () => {
      if (state.gameOver) return;
      if (state.phase !== "pickPair") {
        setStatus("Finish placing your current tile/token before picking a new pair.");
        return;
      }

      if (state.useNatureForMixedPair) {
        if (state.mixedSelection.tileIndex === null) {
          state.mixedSelection.tileIndex = index;
          setStatus("Mixed pick mode: selected tile source. Now select any token source pair.");
        } else if (state.mixedSelection.tokenIndex === null) {
          state.mixedSelection.tokenIndex = index;
          const chosen = currentChosenPair();
          state.selectedPair = chosen;
          state.pendingRotation = 0;
          state.phase = "placeTile";
          setStatus(`Mixed pair selected. Place tile and then token ${chosen.token}.`);
          addEventLog(`Selected mixed pair: tile from slot ${chosen.tileIndex + 1}, token from slot ${chosen.tokenIndex + 1}.`);
        } else {
          clearMixedSelection();
          state.mixedSelection.tileIndex = index;
          state.selectedPair = null;
          setStatus("Mixed pick mode reset. Tile source selected again.");
        }
        render();
        return;
      }

      state.selectedPairIndex = index;
      state.selectedPair = {
        tileDraft: state.market[index].tileDraft,
        token: state.market[index].token,
        tileIndex: index,
        tokenIndex: index,
        isMixedPair: false,
      };
      state.pendingRotation = 0;
      state.phase = "placeTile";
      addEventLog(`Selected market pair from slot ${index + 1}.`);
      setStatus("Pair selected. Place tile on an open adjacent hex (rotate if needed).");
      render();
    });

    marketTilesEl.appendChild(pairEl);
  });
}


function tileContainsTerrain(tile, terrainType) {
  return tile.terrainsPresent.includes(terrainType);
}

function terrainEdgeMatches(tileA, tileB, directionIndex, terrainType) {
  const opposite = (directionIndex + 3) % 6;
  return tileA.edges[directionIndex] === terrainType && tileB.edges[opposite] === terrainType;
}

function buildTerrainRegionGroups(terrainType) {
  const parents = new Map();
  const sizes = new Map();

  function makeSet(coordKey) {
    parents.set(coordKey, coordKey);
    sizes.set(coordKey, 1);
  }

  function find(coordKey) {
    let root = coordKey;
    while (parents.get(root) !== root) root = parents.get(root);

    let current = coordKey;
    while (parents.get(current) !== current) {
      const next = parents.get(current);
      parents.set(current, root);
      current = next;
    }

    return root;
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;

    const sizeA = sizes.get(rootA) ?? 1;
    const sizeB = sizes.get(rootB) ?? 1;

    if (sizeA < sizeB) {
      parents.set(rootA, rootB);
      sizes.set(rootB, sizeA + sizeB);
      return;
    }

    parents.set(rootB, rootA);
    sizes.set(rootA, sizeA + sizeB);
  }

  for (const [coordKey, tile] of state.tiles.entries()) {
    if (tileContainsTerrain(tile, terrainType)) makeSet(coordKey);
  }

  for (const [coordKey, tile] of state.tiles.entries()) {
    if (!tileContainsTerrain(tile, terrainType)) continue;

    const { q, r } = parseKey(coordKey);
    axialDirections.forEach(([dq, dr], directionIndex) => {
      const neighborKey = key(q + dq, r + dr);
      const neighborTile = state.tiles.get(neighborKey);
      if (!neighborTile || !tileContainsTerrain(neighborTile, terrainType)) return;
      if (!terrainEdgeMatches(tile, neighborTile, directionIndex, terrainType)) return;
      union(coordKey, neighborKey);
    });
  }

  const groups = new Map();
  for (const coordKey of parents.keys()) {
    const root = find(coordKey);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(coordKey);
  }

  return groups;
}

function largestConnectedTerrainGroup(terrainType) {
  const groups = buildTerrainRegionGroups(terrainType);
  let best = 0;
  for (const group of groups.values()) best = Math.max(best, group.length);
  return best;
}

function buildAnimalGroups(animalType) {
  const visited = new Set();
  const groups = [];

  for (const [coordKey, tile] of state.tiles.entries()) {
    if (visited.has(coordKey)) continue;
    if (tile.token !== animalType) continue;

    const group = [];
    const stack = [coordKey];
    visited.add(coordKey);

    while (stack.length) {
      const current = stack.pop();
      group.push(current);
      const { q, r } = parseKey(current);
      neighboringKeys(q, r).forEach((neighborKey) => {
        if (visited.has(neighborKey)) return;
        const neighborTile = state.tiles.get(neighborKey);
        if (!neighborTile || neighborTile.token !== animalType) return;
        visited.add(neighborKey);
        stack.push(neighborKey);
      });
    }

    groups.push(group);
  }

  return groups;
}

function animalCoordKeys(animalType) {
  const coords = [];
  for (const [coordKey, tile] of state.tiles.entries()) {
    if (tile.token === animalType) coords.push(coordKey);
  }
  return coords;
}

function neighborCoordKeys(coordKey) {
  const { q, r } = parseKey(coordKey);
  return neighboringKeys(q, r);
}

function adjacentAnimalCounts(coordKeys, excludedAnimals = new Set()) {
  const coordSet = new Set(coordKeys);
  const counts = new Map();
  coordKeys.forEach((coordKey) => {
    neighborCoordKeys(coordKey).forEach((neighborKey) => {
      if (coordSet.has(neighborKey)) return;
      const neighborTile = state.tiles.get(neighborKey);
      if (!neighborTile?.token || excludedAnimals.has(neighborTile.token)) return;
      counts.set(neighborTile.token, (counts.get(neighborTile.token) ?? 0) + 1);
    });
  });
  return counts;
}

function connectedComponentsFromSet(coordSet) {
  const remaining = new Set(coordSet);
  const groups = [];
  while (remaining.size > 0) {
    const start = remaining.values().next().value;
    remaining.delete(start);
    const group = [start];
    const stack = [start];
    while (stack.length) {
      const current = stack.pop();
      neighborCoordKeys(current).forEach((neighborKey) => {
        if (!remaining.has(neighborKey)) return;
        remaining.delete(neighborKey);
        stack.push(neighborKey);
        group.push(neighborKey);
      });
    }
    groups.push(group);
  }
  return groups;
}

function cappedTierScore(count, values) {
  if (count <= 0) return 0;
  return values[Math.min(count, values.length) - 1];
}

function scoreBear() {
  const groups = buildAnimalGroups("🐻");
  const card = state.gameSetup.scoringCards["🐻"];

  if (card === "A") {
    const pairCount = groups.filter((group) => group.length === 2).length;
    return cappedTierScore(pairCount, [4, 11, 19, 27]);
  }
  if (card === "B") {
    return groups.filter((group) => group.length === 3).length * 10;
  }
  if (card === "C") {
    const counts = { 1: 0, 2: 0, 3: 0 };
    groups.forEach((group) => {
      if (group.length >= 1 && group.length <= 3) counts[group.length] += 1;
    });
    const base = counts[1] * 2 + counts[2] * 5 + counts[3] * 8;
    return base + (counts[1] > 0 && counts[2] > 0 && counts[3] > 0 ? 3 : 0);
  }
  return groups.reduce((sum, group) => sum + (group.length === 2 ? 5 : group.length === 3 ? 8 : group.length === 4 ? 13 : 0), 0);
}

function scoringCardName(animal, card) {
  const ruleText = scoringCardRules[animal]?.[card] ?? "";
  return ruleText.split(":")[0] ?? "";
}

function elkLineScore(length) {
  return cappedTierScore(length, [2, 5, 9, 13]);
}

function buildElkLineSegments(elkCoordKeys, indexByKey) {
  const elkSet = new Set(elkCoordKeys);
  const directionPairs = [
    [0, 3],
    [1, 4],
    [2, 5],
  ];
  const segments = new Set();

  directionPairs.forEach(([forwardIndex, backwardIndex]) => {
    const [fdq, fdr] = axialDirections[forwardIndex];
    const [bdq, bdr] = axialDirections[backwardIndex];

    elkCoordKeys.forEach((coordKey) => {
      const { q, r } = parseKey(coordKey);
      const prevKey = key(q + bdq, r + bdr);
      if (elkSet.has(prevKey)) return;

      const run = [];
      let cq = q;
      let cr = r;
      while (elkSet.has(key(cq, cr))) {
        run.push(key(cq, cr));
        cq += fdq;
        cr += fdr;
      }

      for (let start = 0; start < run.length; start += 1) {
        let mask = 0;
        for (let end = start; end < run.length; end += 1) {
          const index = indexByKey.get(run[end]);
          mask |= 1 << index;
          segments.add(mask);
        }
      }
    });
  });

  return Array.from(segments);
}

function scoreElk() {
  const elkCoords = animalCoordKeys("🦌");
  if (elkCoords.length === 0) return 0;

  const card = state.gameSetup.scoringCards["🦌"];
  if (card === "C") {
    return buildAnimalGroups("🦌").reduce((sum, group) => sum + cappedTierScore(group.length, [2, 4, 7, 10, 14, 18, 23, 28]), 0);
  }

  if (card === "D") {
    const used = new Set();
    let total = 0;
    for (const [coordKey] of state.tiles.entries()) {
      const neighbors = neighborCoordKeys(coordKey).filter((n) => state.tiles.get(n)?.token === "🦌" && !used.has(n));
      if (neighbors.length === 0) continue;
      const groups = connectedComponentsFromSet(new Set(neighbors));
      groups.forEach((group) => {
        if (group.length >= 1 && group.length <= 6) {
          total += cappedTierScore(group.length, [2, 5, 8, 12, 16, 21]);
          group.forEach((g) => used.add(g));
        }
      });
    }
    return total;
  }

  const indexByKey = new Map(elkCoords.map((coordKey, index) => [coordKey, index]));
  let segments = buildElkLineSegments(elkCoords, indexByKey);
  if (card === "B") {
    const elkSet = new Set(elkCoords);
    elkCoords.forEach((centerKey) => {
      const neighbors = neighborCoordKeys(centerKey).filter((n) => elkSet.has(n));
      if (neighbors.length >= 2) {
        for (let i = 0; i < neighbors.length; i += 1) {
          for (let j = i + 1; j < neighbors.length; j += 1) {
            const a = parseKey(neighbors[i]);
            const b = parseKey(neighbors[j]);
            const c = parseKey(centerKey);
            const connected = neighboringKeys(a.q, a.r).includes(neighbors[j]);
            if (connected) {
              const tri = (1 << indexByKey.get(centerKey)) | (1 << indexByKey.get(neighbors[i])) | (1 << indexByKey.get(neighbors[j]));
              segments.push(tri);
            }
          }
        }
      }
      if (neighbors.length >= 4) {
        for (let i = 0; i < neighbors.length; i += 1) {
          for (let j = i + 1; j < neighbors.length; j += 1) {
            for (let k = j + 1; k < neighbors.length; k += 1) {
              const trio = [neighbors[i], neighbors[j], neighbors[k]];
              const comp = connectedComponentsFromSet(new Set(trio));
              if (comp.length === 1) {
                const mask = trio.reduce((acc, coord) => acc | (1 << indexByKey.get(coord)), 1 << indexByKey.get(centerKey));
                if (countBits(mask) === 4) segments.push(mask);
              }
            }
          }
        }
      }
    });
    segments = Array.from(new Set(segments));
  }
  const segmentsByIndex = elkCoords.map(() => []);

  segments.forEach((segmentMask) => {
    for (let i = 0; i < elkCoords.length; i += 1) {
      if (segmentMask & (1 << i)) segmentsByIndex[i].push(segmentMask);
    }
  });

  const memo = new Map();
  const fullMask = (1 << elkCoords.length) - 1;

  function best(mask) {
    if (mask === 0) return 0;
    if (memo.has(mask)) return memo.get(mask);

    const pivotBit = mask & -mask;
    const pivotIndex = Math.log2(pivotBit);
    let top = 0;

    segmentsByIndex[pivotIndex].forEach((segmentMask) => {
      if ((segmentMask & mask) !== segmentMask) return;
      const segmentLength = countBits(segmentMask);
      const values = card === "B" ? [2, 5, 9, 13] : [2, 5, 9, 13];
      const score = cappedTierScore(segmentLength, values) + best(mask ^ segmentMask);
      if (score > top) top = score;
    });

    memo.set(mask, top);
    return top;
  }

  return best(fullMask);
}

function countBits(mask) {
  let count = 0;
  let value = mask;
  while (value) {
    value &= value - 1;
    count += 1;
  }
  return count;
}

function scoreFox() {
  const card = state.gameSetup.scoringCards["🦊"];
  let score = 0;

  for (const [coordKey, tile] of state.tiles.entries()) {
    if (tile.token !== "🦊") continue;

    const { q, r } = parseKey(coordKey);
    const neighborTokens = [];
    neighboringKeys(q, r).forEach((neighborKey) => {
      const neighborTile = state.tiles.get(neighborKey);
      if (!neighborTile || !neighborTile.token) return;
      neighborTokens.push(neighborTile.token);
    });

    if (card === "A") {
      score += cappedTierScore(new Set(neighborTokens).size, [1, 2, 3, 4, 5]);
    } else if (card === "B") {
      const counts = new Map();
      neighborTokens.filter((t) => t !== "🦊").forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
      const speciesWithPair = Array.from(counts.values()).filter((count) => count >= 2).length;
      score += cappedTierScore(speciesWithPair, [3, 5, 7]);
    } else if (card === "C") {
      const counts = new Map();
      neighborTokens.filter((t) => t !== "🦊").forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
      const largest = Math.max(0, ...counts.values());
      score += cappedTierScore(largest, [1, 2, 3, 4, 5, 6]);
    }
  }

  if (card === "D") {
    const groups = buildAnimalGroups("🦊").filter((group) => group.length === 2);
    return groups.reduce((sum, group) => {
      const counts = adjacentAnimalCounts(group, new Set(["🦊"]));
      const speciesWithPair = Array.from(counts.values()).filter((count) => count >= 2).length;
      return sum + cappedTierScore(speciesWithPair, [5, 7, 9, 11]);
    }, 0);
  }

  return score;
}

function hawkLineOfSightPairs() {
  const hawks = new Set(animalCoordKeys("🦅"));
  const pairs = [];
  const directionPairs = [0, 1, 2];
  hawks.forEach((coordKey) => {
    const { q, r } = parseKey(coordKey);
    directionPairs.forEach((directionIndex) => {
      const [dq, dr] = axialDirections[directionIndex];
      let cq = q + dq;
      let cr = r + dr;
      let distance = 1;
      while (true) {
        const probe = key(cq, cr);
        if (!state.tiles.has(probe)) break;
        if (hawks.has(probe)) {
          if (distance > 1) pairs.push([coordKey, probe]);
          break;
        }
        cq += dq;
        cr += dr;
        distance += 1;
      }
    });
  });
  return pairs;
}

function scoreHawk() {
  const hawks = animalCoordKeys("🦅");
  const card = state.gameSetup.scoringCards["🦅"];
  const solitary = hawks.filter((coordKey) => neighborCoordKeys(coordKey).every((n) => state.tiles.get(n)?.token !== "🦅"));
  if (card === "A") return cappedTierScore(solitary.length, [2, 5, 8, 11, 14, 18, 22, 26]);

  const losPairs = hawkLineOfSightPairs();
  if (card === "B") {
    const withSight = new Set(losPairs.flat());
    const count = solitary.filter((h) => withSight.has(h)).length;
    return cappedTierScore(count, [5, 9, 12, 16, 20, 24, 28]);
  }
  if (card === "C") return losPairs.length * 3;

  const speciesBetweenScore = (aKey, bKey) => {
    const a = parseKey(aKey);
    const b = parseKey(bKey);
    const dq = Math.sign(b.q - a.q);
    const dr = Math.sign(b.r - a.r);
    const seen = new Set();
    let cq = a.q + dq;
    let cr = a.r + dr;
    while (cq !== b.q || cr !== b.r) {
      const midToken = state.tiles.get(key(cq, cr))?.token;
      if (midToken) seen.add(midToken);
      cq += dq;
      cr += dr;
    }
    const unique = seen.size;
    if (unique === 1) return 4;
    if (unique === 2) return 7;
    if (unique === 3) return 9;
    return 0;
  };
  const available = [...losPairs].sort((a, b) => speciesBetweenScore(b[0], b[1]) - speciesBetweenScore(a[0], a[1]));
  const used = new Set();
  let total = 0;
  available.forEach(([a, b]) => {
    if (used.has(a) || used.has(b)) return;
    const pairScore = speciesBetweenScore(a, b);
    if (pairScore <= 0) return;
    used.add(a);
    used.add(b);
    total += pairScore;
  });
  return total;
}

function salmonRuns() {
  const groups = buildAnimalGroups("🐟");
  return groups.filter((group) => {
    const groupSet = new Set(group);
    const validDegrees = group.every((coordKey) => {
      const neighbors = neighborCoordKeys(coordKey).filter((neighborKey) => groupSet.has(neighborKey));
      return neighbors.length <= 2;
    });
    if (!validDegrees) return false;
    return group.every((coordKey) =>
      neighborCoordKeys(coordKey).every((neighborKey) => !state.tiles.get(neighborKey)?.token || groupSet.has(neighborKey) || state.tiles.get(neighborKey).token !== "🐟")
    );
  });
}

function scoreSalmon() {
  const runs = salmonRuns();
  const card = state.gameSetup.scoringCards["🐟"];
  if (card === "A") return runs.reduce((sum, group) => sum + cappedTierScore(group.length, [2, 5, 8, 12, 16, 20, 25]), 0);
  if (card === "B") return runs.reduce((sum, group) => sum + cappedTierScore(group.length, [2, 4, 9, 11, 17]), 0);
  if (card === "C") {
    return runs.reduce((sum, group) => {
      if (group.length === 3) return sum + 10;
      if (group.length === 4) return sum + 12;
      if (group.length >= 5) return sum + 15;
      return sum;
    }, 0);
  }
  return runs.reduce((sum, group) => {
    const groupSet = new Set(group);
    if (group.length < 3) return sum;
    const adjacent = new Set();
    group.forEach((coordKey) => {
      neighborCoordKeys(coordKey).forEach((neighborKey) => {
        const token = state.tiles.get(neighborKey)?.token;
        if (!token) return;
        if (groupSet.has(neighborKey)) return;
        adjacent.add(neighborKey);
      });
    });
    return sum + group.length + adjacent.size;
  }, 0);
}

function computeAnimalScores() {
  return {
    "🦌": scoreElk(),
    "🦊": scoreFox(),
    "🐻": scoreBear(),
    "🦅": scoreHawk(),
    "🐟": scoreSalmon(),
  };
}

function computeScoreBreakdown() {
  const terrainScores = {};
  const animalScores = {};

  terrains.forEach((terrain) => {
    terrainScores[terrain] = largestConnectedTerrainGroup(terrain);
  });

  Object.assign(animalScores, computeAnimalScores());

  const terrainTotal = terrains.reduce((sum, terrain) => sum + terrainScores[terrain], 0);
  const animalTotal = animals.reduce((sum, animal) => sum + animalScores[animal], 0);
  const natureTokenPoints = state.natureTokens;

  return {
    terrainScores,
    animalScores,
    terrainTotal,
    animalTotal,
    natureTokenPoints,
    total: terrainTotal + animalTotal + natureTokenPoints,
  };
}

function renderScoreBreakdown(score) {
  const terrainItems = terrains
    .map((terrain) => `<li><span class="terrain-chip" style="background:${terrainColors[terrain]};"></span>${terrainNames[terrain]}: ${score.terrainScores[terrain]}</li>`)
    .join("");

  const animalTips = Object.fromEntries(
    animals.map((animal) => {
      const card = state.gameSetup.scoringCards[animal] ?? "A";
      return [animal, `[Card ${card}] ${scoringCardRules[animal][card]}`];
    })
  );

  const animalItems = animals
    .map((animal) => {
      const card = state.gameSetup.scoringCards[animal] ?? "A";
      const cardName = scoringCardName(animal, card);
      return `<li>${animal}${card}: ${cardName}: ${score.animalScores[animal]}${infoTip(animalTips[animal])}</li>`;
    })
    .join("");

  scoreBreakdownEl.innerHTML = `
    <div class="score-columns">
      <div class="score-column">
        <strong>Terrain contributions${infoTip("For each type of terrain, score 1 point for each tile in the largest, connected group of tiles of that terrain type.")}</strong>
        <ul>${terrainItems}</ul>
        <p class="score-subtotal">Terrain subtotal: ${score.terrainTotal}</p>
      </div>
      <div class="score-column">
        <strong>Animal contributions${infoTip("Each type of animal has a special rule for how they are scored.")}</strong>
        <ul>${animalItems}</ul>
        <p class="score-subtotal">Animal subtotal: ${score.animalTotal}</p>
      </div>
    </div>
  `;
}


function infoTip(text) {
  return `<span class="info-popover" tabindex="0" aria-label="Scoring explanation" data-tip="${text.replace(/"/g, "&quot;")}">?</span>`;
}

function stableTileSnapshotEntries(tilesMap) {
  return Array.from(tilesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([coordKey, tile]) => [coordKey, copyTile(tile)]);
}

function turnStateHash() {
  return JSON.stringify({
    tiles: stableTileSnapshotEntries(state.tiles),
    market: state.market.map(copyPair),
    selectedPairIndex: state.selectedPairIndex,
    selectedPair: state.selectedPair ? copyPair(state.selectedPair) : null,
    pendingRotation: state.pendingRotation,
    phase: state.phase,
    turn: state.turn,
    gameOver: state.gameOver,
    pendingDiscardReason: state.pendingDiscardReason,
    natureTokens: state.natureTokens,
    useNatureForMixedPair: state.useNatureForMixedPair,
    mixedSelection: { ...state.mixedSelection },
    tileBag: state.tileBag.map((tile) => tile.id),
    animalBag: [...state.animalBag],
    pendingAnimalReturns: [...state.pendingAnimalReturns],
  });
}

function canResetTurn() {
  if (!state.turnStartSnapshot || state.gameOver) return false;
  return turnStateHash() !== state.turnStartSnapshot.turnStateHash;
}

function copyPair(pair) {
  return {
    tileDraft: { ...pair.tileDraft, printedAnimals: [...pair.tileDraft.printedAnimals] },
    token: pair.token,
  };
}

function copyTile(tile) {
  return {
    ...tile,
    printedAnimals: [...tile.printedAnimals],
    terrainsPresent: [...tile.terrainsPresent],
    edges: [...tile.edges],
  };
}

function snapshotTurnStart() {
  state.turnStartSnapshot = {
    tiles: new Map(stableTileSnapshotEntries(state.tiles)),
    market: state.market.map(copyPair),
    selectedPairIndex: state.selectedPairIndex,
    selectedPair: state.selectedPair ? copyPair(state.selectedPair) : null,
    pendingRotation: state.pendingRotation,
    phase: state.phase,
    turn: state.turn,
    gameOver: state.gameOver,
    pendingDiscardReason: state.pendingDiscardReason,
    natureTokens: state.natureTokens,
    useNatureForMixedPair: state.useNatureForMixedPair,
    mixedSelection: { ...state.mixedSelection },
    tileBag: state.tileBag.map((tile) => ({ ...tile, printedAnimals: [...tile.printedAnimals] })),
    animalBag: [...state.animalBag],
    pendingAnimalReturns: [...state.pendingAnimalReturns],
    eventLog: [...state.eventLog],
    turnStateHash: turnStateHash(),
  };
}

function resetToTurnStart() {
  if (!state.turnStartSnapshot || state.gameOver) return;

  const snapshot = state.turnStartSnapshot;
  state.tiles = new Map(Array.from(snapshot.tiles.entries(), ([coordKey, tile]) => [coordKey, copyTile(tile)]));
  state.market = snapshot.market.map(copyPair);
  state.selectedPairIndex = snapshot.selectedPairIndex;
  state.selectedPair = snapshot.selectedPair ? copyPair(snapshot.selectedPair) : null;
  state.pendingRotation = snapshot.pendingRotation;
  state.phase = snapshot.phase;
  state.turn = snapshot.turn;
  state.gameOver = snapshot.gameOver;
  state.pendingDiscardReason = snapshot.pendingDiscardReason;
  state.natureTokens = snapshot.natureTokens;
  state.useNatureForMixedPair = snapshot.useNatureForMixedPair;
  state.mixedSelection = { ...snapshot.mixedSelection };
  state.tileBag = snapshot.tileBag.map((tile) => ({ ...tile, printedAnimals: [...tile.printedAnimals] }));
  state.animalBag = [...snapshot.animalBag];
  state.pendingAnimalReturns = [...snapshot.pendingAnimalReturns];
  state.eventLog = [...snapshot.eventLog];
  state.hoverCoordKey = null;

  addEventLog("Turn state reset to latest random-event checkpoint.");
  setStatus("Turn reset to latest checkpoint.");
  render();
}

function finishTurn(chosenPair, placedToken, discardedTokenReason) {
  const removed = removePickedMarketPair(chosenPair);
  const leftmostDiscard = removeLeftmostMarketPair();
  refillMarketToFour();

  let forcedRefresh = false;
  while (forceMarketQuadRefresh()) {
    forcedRefresh = true;
  }

  if (chosenPair?.isMixedPair) {
    addEventLog(`Mixed pick consumed two market slots (${chosenPair.tileIndex + 1} and ${chosenPair.tokenIndex + 1}).`);
  }
  if (leftmostDiscard) addEventLog(`Leftmost market pair token ${leftmostDiscard.token} discarded and refilled.`);
  if (forcedRefresh) addEventLog("Mandatory quad-token refresh was applied.");

  returnPendingAnimalTokensToBag();

  if (state.turn >= state.maxTurns) {
    state.gameOver = true;
    state.phase = "gameOver";
    state.score = computeScoreBreakdown();
    setStatus(
      `Game over! Terrain ${state.score.terrainTotal} + Animal ${state.score.animalTotal} + Stars ${state.score.natureTokenPoints} = ${state.score.total}.`
    );
    addEventLog(`Game ended with total score ${state.score.total}.`);
  } else {
    state.turn += 1;
    state.phase = "pickPair";
    if (discardedTokenReason) {
      setStatus(`Placed tile. Token ${chosenPair.token} discarded (${discardedTokenReason}).`);
      addEventLog(`Token ${chosenPair.token} was discarded (${discardedTokenReason}).`);
    } else {
      setStatus(`Placed tile and token ${placedToken}.`);
      addEventLog(`Placed token ${placedToken}.`);
    }
  }

  state.selectedPair = null;
  state.selectedPairIndex = null;
  state.pendingRotation = 0;
  state.hoverCoordKey = null;
  state.pendingDiscardReason = null;
  state.useNatureForMixedPair = false;
  clearMixedSelection();
  if (!state.gameOver) snapshotTurnStart();
  render();
}


function hoverTokenIsLegal(coordKey) {
  if (state.phase !== "placeToken" || !state.selectedPair) return false;
  const tile = state.tiles.get(coordKey);
  return Boolean(tile && !tile.token && tile.printedAnimals.includes(state.selectedPair.token));
}

function onBoardHexClick(event) {
  if (state.gameOver) return;
  const q = Number(event.currentTarget.dataset.q);
  const r = Number(event.currentTarget.dataset.r);
  const coordKey = key(q, r);

  if (state.phase === "placeTile") {
    if (!state.selectedPair) {
      setStatus("Pick a pair first.");
      return;
    }
    if (state.tiles.has(coordKey)) {
      setStatus("Tile must be placed on an open adjacent hex.");
      return;
    }
    const openKeys = new Set(openPlacementKeys());
    if (!openKeys.has(coordKey)) {
      setStatus("Tile must be adjacent to existing hexes.");
      return;
    }

    const placedTile = tileFromDraft(state.selectedPair.tileDraft, state.pendingRotation);
    state.tiles.set(coordKey, placedTile);
    state.phase = "placeToken";
    addEventLog(`Placed tile at (${q}, ${r}) with rotation ${state.pendingRotation * 60}°.`);

    if (!canPlaceTokenAnywhere(state.selectedPair.token)) {
      state.pendingDiscardReason = "no legal tile for token";
      state.phase = "confirmDiscard";
      setStatus(`Tile placed. Token ${state.selectedPair.token} has no legal placement. Confirm discard to finish turn.`);
      render();
      return;
    }

    setStatus(`Tile placed. Now place token ${state.selectedPair.token} on any legal tile.`);
    render();
    return;
  }

  if (state.phase === "placeToken") {
    const tile = state.tiles.get(coordKey);
    if (!tile) {
      setStatus("Token can only be placed on an existing tile.");
      return;
    }
    if (tile.token) {
      setStatus("That tile already has a token.");
      return;
    }
    if (!tile.printedAnimals.includes(state.selectedPair.token)) {
      setStatus("This token type is not printed on that tile.");
      return;
    }

    tile.token = state.selectedPair.token;
    if (tile.bonusOnToken) {
      state.natureTokens += 1;
      tile.bonusOnToken = false;
      setStatus(`Placed token ${state.selectedPair.token} and gained 1 star.`);
      addEventLog(`Gained 1 star by placing on a single-terrain hex.`);
    }
    finishTurn(state.selectedPair, state.selectedPair.token, null);
  }
}

function rotatePending(delta) {
  if (state.phase !== "placeTile" || !state.selectedPair) {
    setStatus("Select a pair and enter tile placement phase before rotating.");
    return;
  }
  if (state.selectedPair.tileDraft.kind === "single") {
    setStatus("This is a single-terrain tile; rotation has no effect.");
    return;
  }

  state.pendingRotation = (state.pendingRotation + delta + 6) % 6;
  addEventLog(`Adjusted pending rotation to ${state.pendingRotation * 60}°.`);
  setStatus(`Rotation set to ${state.pendingRotation * 60}° for the selected tile.`);
  render();
}

function render() {
  const score = computeScoreBreakdown();
  state.score = score;
  turnCounterEl.textContent = `${Math.min(state.turn, state.maxTurns)} / ${state.maxTurns}`;
  starCounterEl.textContent = String(score.natureTokenPoints);
  scoreFormulaEl.textContent = `${score.terrainTotal} + ${score.animalTotal} + ${score.natureTokenPoints} = ${score.total}`;
  renderScoreBreakdown(score);

  const tripleAnimal = availableTripleTokenAnimal();
  rerollTripleBtn.disabled = state.gameOver || state.phase !== "pickPair" || !tripleAnimal;
  rerollTripleBtn.textContent = tripleAnimal ? `Reroll 3 ${animalNames[tripleAnimal]}` : "Reroll 3-of-a-Kind";

  const canRotate =
    !state.gameOver &&
    state.phase === "placeTile" &&
    state.selectedPair &&
    state.selectedPair.tileDraft.kind === "split";
  rotateLeftBtn.disabled = !canRotate;
  rotateRightBtn.disabled = !canRotate;

  toggleSplitPickBtn.disabled = state.gameOver || state.phase !== "pickPair" || state.natureTokens <= 0;
  toggleSplitPickBtn.textContent = state.useNatureForMixedPair ? "Cancel Mixed Pair" : "−1 ★ Mixed Pair";
  rerollSelectedTokensBtn.disabled = state.gameOver || state.phase !== "pickPair" || state.natureTokens <= 0;
  rerollSelectedTokensBtn.textContent = "−1 ★ Refresh Tokens";

  confirmDiscardBtn.disabled = state.phase !== "confirmDiscard";
  resetTurnBtn.disabled = !canResetTurn();

  const showRotateControls = !rotateLeftBtn.disabled;
  rotateLeftBtn.classList.toggle("hidden", !showRotateControls);
  rotateRightBtn.classList.toggle("hidden", !showRotateControls);
  confirmDiscardBtn.classList.toggle("hidden", state.phase !== "confirmDiscard");

  renderMarket();
  renderBoard();
  renderEventLog();
  floatingStatusTextEl.textContent = floatingStatusText();
}

function populateSetupSelect(selectEl, options, defaultValue) {
  selectEl.innerHTML = options
    .map((option) => `<option value="${option.value}" ${option.value === defaultValue ? "selected" : ""}>${option.label}</option>`)
    .join("");
}

function initializeSetupScreen() {
  const starterSetOptions = STARTER_TILE_SETS.map((starterSet, index) => {
    const signatureTile = starterSet.find(
      (starter) => starter.tile.kind === "single" && starter.tile.printedAnimals.length === 1
    );
    const label = signatureTile ? (animalNames[signatureTile.tile.printedAnimals[0]] ?? `Set ${index + 1}`) : `Set ${index + 1}`;
    return { value: String(index), label };
  });

  populateSetupSelect(
    setupStartingTileEl,
    [
      ...starterSetOptions,
      { value: "random", label: "Random" },
    ],
    "random"
  );
  const cardOptions = [
    { value: "A", label: "A" },
    { value: "B", label: "B" },
    { value: "C", label: "C" },
    { value: "D", label: "D" },
    { value: "random", label: "Random" },
  ];
  populateSetupSelect(setupCardBearEl, cardOptions, "random");
  populateSetupSelect(setupCardElkEl, cardOptions, "random");
  populateSetupSelect(setupCardSalmonEl, cardOptions, "random");
  populateSetupSelect(setupCardHawkEl, cardOptions, "random");
  populateSetupSelect(setupCardFoxEl, cardOptions, "random");
}

function applySetupSelections() {
  state.gameSetup.starterSetIndex = selectWithRandom(setupStartingTileEl.value, STARTER_TILE_SETS.length);
  const selections = {
    "🐻": setupCardBearEl.value,
    "🦌": setupCardElkEl.value,
    "🐟": setupCardSalmonEl.value,
    "🦅": setupCardHawkEl.value,
    "🦊": setupCardFoxEl.value,
  };
  Object.entries(selections).forEach(([animal, selected]) => {
    state.gameSetup.scoringCards[animal] = selected === "random" ? randomCardLetter() : selected;
  });
}

function restartGame() {
  state.tiles = new Map();
  placeStarterTriangle();
  state.market = [];
  state.tileBag = TILE_REFERENCE_LIST.map((tile) => ({ ...tile, printedAnimals: [...tile.printedAnimals] }));
  shuffleInPlace(state.tileBag);
  state.animalBag = animals.flatMap((animal) => Array(20).fill(animal));
  shuffleInPlace(state.animalBag);
  state.pendingAnimalReturns = [];
  refillMarketToFour();
  state.selectedPairIndex = null;
  state.selectedPair = null;
  state.pendingRotation = 0;
  state.turn = 1;
  state.phase = "pickPair";
  state.gameOver = false;
  state.score = computeScoreBreakdown();
  state.hoverCoordKey = null;
  state.pendingDiscardReason = null;
  state.natureTokens = 0;
  state.useNatureForMixedPair = false;
  clearMixedSelection();
  state.eventLog = [];

  addEventLog("New game started.");
  while (forceMarketQuadRefresh()) {
    addEventLog("Initial market had four matching tokens; refreshed automatically.");
  }

  snapshotTurnStart();
  setStatus("New game started. Pick a pair, place tile first, then token.");
  render();
}

restartBtn.addEventListener("click", restartGame);
resetTurnBtn.addEventListener("click", resetToTurnStart);
confirmDiscardBtn.addEventListener("click", () => {
  if (state.phase !== "confirmDiscard" || !state.selectedPair) return;
  finishTurn(state.selectedPair, null, state.pendingDiscardReason ?? "no legal tile for token");
});
rotateLeftBtn.addEventListener("click", () => rotatePending(-1));
rotateRightBtn.addEventListener("click", () => rotatePending(1));

toggleSplitPickBtn.addEventListener("click", () => {
  if (state.gameOver || state.phase !== "pickPair") return;

  if (state.useNatureForMixedPair) {
    state.useNatureForMixedPair = false;
    clearMixedSelection();
    state.selectedPair = null;
    setStatus("Mixed-pair mode cancelled.");
    render();
    return;
  }

  if (!spendNatureToken("enable mixed pair selection")) {
    setStatus("Not enough stars.");
    render();
    return;
  }

  state.useNatureForMixedPair = true;
  clearMixedSelection();
  state.selectedPair = null;
  setStatus("Mixed-pair mode enabled. Select tile source, then token source.");
  render();
});

rerollSelectedTokensBtn.addEventListener("click", () => {
  if (state.gameOver || state.phase !== "pickPair") return;
  if (!spendNatureToken("reroll all market tokens")) {
    setStatus("Not enough stars.");
    render();
    return;
  }

  const promptResult = window.prompt("Choose token slots to refresh (1-4), separated by commas/spaces:", "1 2 3 4");
  const selectedIndexes = parseRefreshSelection(promptResult);
  if (!selectedIndexes || selectedIndexes.length === 0) {
    setStatus("Refresh cancelled. No market tokens were changed.");
    render();
    return;
  }

  selectedIndexes.forEach((index) => replaceTokenAtIndex(index));
  addEventLog(`Refreshed selected market token slots: ${selectedIndexes.map((index) => index + 1).join(", ")}.`);

  while (forceMarketQuadRefresh()) {
    addEventLog("Quad-token market refresh triggered after reroll.");
  }

  snapshotTurnStart();
  setStatus("Spent 1 star to refresh all market tokens.");
  render();
});

rerollTripleBtn.addEventListener("click", () => {
  if (state.gameOver || state.phase !== "pickPair") return;
  const refreshed = performOptionalTripleRefresh();
  if (!refreshed) {
    setStatus("No triple token set is available to reroll.");
    render();
    return;
  }
  while (forceMarketQuadRefresh()) {
    addEventLog("Quad-token market refresh triggered after triple refresh.");
  }
  snapshotTurnStart();
  setStatus("Triple token set rerolled.");
  render();
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "z") {
    rotatePending(-1);
  }
  if (event.key.toLowerCase() === "x") {
    rotatePending(1);
  }
});

startGameBtn.addEventListener("click", () => {
  applySetupSelections();
  setupScreenEl.classList.add("hidden");
  gameScreenEl.classList.remove("hidden");
  restartGame();
});

function updateHoverCoordFromEventTarget(event) {
  if (state.phase !== "placeTile" && state.phase !== "placeToken") {
    state.hoverCoordKey = null;
    return;
  }

  const hexEl = event.target.closest(".hex");
  if (!hexEl || !boardEl.contains(hexEl)) {
    state.hoverCoordKey = null;
    return;
  }

  const hoverKey = key(Number(hexEl.dataset.q), Number(hexEl.dataset.r));
  if (state.phase === "placeTile") {
    state.hoverCoordKey = state.boardLayout.openKeys.has(hoverKey) ? hoverKey : null;
    return;
  }

  state.hoverCoordKey = hoverTokenIsLegal(hoverKey) ? hoverKey : null;
}

boardEl.addEventListener("mousemove", (event) => {
  const prev = state.hoverCoordKey;
  updateHoverCoordFromEventTarget(event);
  if (prev !== state.hoverCoordKey) renderBoard();
});

boardEl.addEventListener("mouseleave", () => {
  if (!state.hoverCoordKey) return;
  state.hoverCoordKey = null;
  renderBoard();
});

initializeSetupScreen();
