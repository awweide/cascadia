const FULL_TURNS = 20;
const HEX_SIZE = 54;

const terrains = ["forest", "river", "mountain", "prairie", "wetland"];
const animals = ["🦌", "🦊", "🐻", "🦅", "🐟"];
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
};

const turnCounterEl = document.getElementById("turn-counter");
const phaseLabelEl = document.getElementById("phase-label");
const finalScoreEl = document.getElementById("final-score");
const scoreBreakdownEl = document.getElementById("score-breakdown");
const marketTilesEl = document.getElementById("market-tiles");
const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart-btn");
const rotateLeftBtn = document.getElementById("rotate-left-btn");
const rotateRightBtn = document.getElementById("rotate-right-btn");
const toggleSplitPickBtn = document.getElementById("toggle-split-pick-btn");
const rerollSelectedTokensBtn = document.getElementById("reroll-selected-tokens-btn");
const rerollTripleBtn = document.getElementById("reroll-triple-btn");
const resetTurnBtn = document.getElementById("reset-turn-btn");
const confirmDiscardBtn = document.getElementById("confirm-discard-btn");
const eventLogEl = document.getElementById("event-log");

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

function randomDistinctAnimals(count) {
  const pool = [...animals];
  const picks = [];
  while (picks.length < count && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    picks.push(pool[index]);
    pool.splice(index, 1);
  }
  return picks;
}

function randomDistinctTerrains() {
  const first = randomItem(terrains);
  let second = randomItem(terrains);
  while (second === first) second = randomItem(terrains);
  return [first, second];
}

function drawDraftTileByType(type) {
  if (type === "single-single") {
    return {
      kind: "single",
      terrain: randomItem(terrains),
      printedAnimals: [randomItem(animals)],
      bonusOnToken: true,
      marketType: type,
    };
  }

  const [terrainA, terrainB] = randomDistinctTerrains();
  const animalCount = type === "split-double" ? 2 : 3;
  return {
    kind: "split",
    terrainA,
    terrainB,
    printedAnimals: randomDistinctAnimals(animalCount),
    bonusOnToken: false,
    marketType: type,
  };
}

function drawDraftTile() {
  const roll = Math.random();
  if (roll < 1 / 3) return drawDraftTileByType("single-single");
  if (roll < 2 / 3) return drawDraftTileByType("split-double");
  return drawDraftTileByType("split-triple");
}

function drawPair() {
  return {
    tileDraft: drawDraftTile(),
    token: randomItem(animals),
  };
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
  while (state.market.length < 4) state.market.push(drawPair());
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

function placeStarterTriangle() {
  const starterTiles = [
    {
      q: 0,
      r: 0,
      tile: {
        kind: "single",
        terrain: "forest",
        printedAnimals: ["🦌"],
        bonusOnToken: true,
      },
      token: null,
      rotation: 0,
    },
    {
      q: 1,
      r: 0,
      tile: {
        kind: "split",
        terrainA: "river",
        terrainB: "mountain",
        printedAnimals: ["🦊", "🐟"],
      },
      token: null,
      rotation: 1,
    },
    {
      q: 0,
      r: 1,
      tile: {
        kind: "split",
        terrainA: "prairie",
        terrainB: "wetland",
        printedAnimals: ["🐻", "🦅", "🦌"],
      },
      token: null,
      rotation: 0,
    },
  ];

  starterTiles.forEach((starter) => {
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
  statusEl.textContent = message;
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
  state.market[index].token = randomItem(animals);
  addEventLog(`Market token ${oldToken} at slot ${index + 1} rerolled to ${state.market[index].token}.`);
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

function spendNatureToken(reason) {
  if (state.natureTokens <= 0) return false;
  state.natureTokens -= 1;
  addEventLog(`Spent 1 star (${reason}).`);
  return true;
}

function phaseLabel() {
  if (state.gameOver) return "Game Over";
  if (state.phase === "pickPair") return "Pick a pair";
  if (state.phase === "placeTile") return `Place tile (rotation ${state.pendingRotation * 60}°)`;
  if (state.phase === "confirmDiscard") return "Confirm discard";
  return "Place token";
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
  const terrain = baseTerrainForCenterColor(tile);
  const factor = terrain === "mountain" ? 0.5 : 0.38;
  return darkenHexColor(terrainColors[terrain], factor);
}

function baseTerrainForCenterColor(tile) {
  if (tile.kind === "single") return tile.terrain;
  return tile.terrainA;
}

function hexTileCenterMarkup(tile, tokenOverride = null) {
  const tokenText = tokenOverride ?? tile.token;
  const starColor = starColorForTile(tile);
  const starMarkup = tile.bonusOnToken ? `<span class="hex-star" style="color:${starColor};">★</span>` : "";
  const printedMarkup = printedAnimalsMarkup(tile.printedAnimals);
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
        <span>Token:</span>
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

function cappedTierScore(count, values) {
  if (count <= 0) return 0;
  return values[Math.min(count, values.length) - 1];
}

function scoreBear() {
  const groups = buildAnimalGroups("🐻");
  const pairCount = groups.filter((group) => group.length === 2).length;
  return cappedTierScore(pairCount, [4, 11, 19, 27]);
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

  const indexByKey = new Map(elkCoords.map((coordKey, index) => [coordKey, index]));
  const segments = buildElkLineSegments(elkCoords, indexByKey);
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
      const score = elkLineScore(segmentLength) + best(mask ^ segmentMask);
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
  let score = 0;

  for (const [coordKey, tile] of state.tiles.entries()) {
    if (tile.token !== "🦊") continue;

    const { q, r } = parseKey(coordKey);
    const neighborAnimals = new Set();
    neighboringKeys(q, r).forEach((neighborKey) => {
      const neighborTile = state.tiles.get(neighborKey);
      if (!neighborTile || !neighborTile.token) return;
      neighborAnimals.add(neighborTile.token);
    });

    score += cappedTierScore(neighborAnimals.size, [1, 2, 3, 4, 5]);
  }

  return score;
}

function scoreHawk() {
  const groups = buildAnimalGroups("🦅");
  const isolatedCount = groups.filter((group) => group.length === 1).length;
  return cappedTierScore(isolatedCount, [2, 5, 8, 11, 14, 18, 22, 26]);
}

function scoreSalmon() {
  const groups = buildAnimalGroups("🐟");
  let score = 0;

  groups.forEach((group) => {
    const groupSet = new Set(group);
    const valid = group.every((coordKey) => {
      const { q, r } = parseKey(coordKey);
      let adjacentFish = 0;
      neighboringKeys(q, r).forEach((neighborKey) => {
        if (groupSet.has(neighborKey)) adjacentFish += 1;
      });
      return adjacentFish >= 1 && adjacentFish <= 2;
    });

    if (!valid) return;
    score += cappedTierScore(group.length, [2, 5, 8, 12, 16, 20, 25]);
  });

  return score;
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
    .map((terrain) => `<li>${terrainNames[terrain]}: ${score.terrainScores[terrain]}</li>`)
    .join("");
  const animalItems = animals
    .map((animal) => `<li>${animal} ${animalNames[animal]}: ${score.animalScores[animal]}</li>`)
    .join("");

  scoreBreakdownEl.innerHTML = `
    <div class="score-columns">
      <div class="score-column">
        <strong>Terrain contributions</strong>
        <ul>${terrainItems}</ul>
        <p class="score-subtotal">Terrain subtotal: ${score.terrainTotal}</p>
      </div>
      <div class="score-column">
        <strong>Animal contributions</strong>
        <ul>${animalItems}</ul>
        <p class="score-subtotal">Animal subtotal: ${score.animalTotal}</p>
        <p class="score-subtotal">Stars bonus: ${score.natureTokenPoints}</p>
      </div>
    </div>
  `;
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
    tiles: new Map(Array.from(state.tiles.entries(), ([coordKey, tile]) => [coordKey, copyTile(tile)])),
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
    eventLog: [...state.eventLog],
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
  state.eventLog = [...snapshot.eventLog];
  state.hoverCoordKey = null;

  addEventLog("Turn state reset to start-of-turn snapshot.");
  setStatus("Turn reset to start. Pick a pair, place tile first, then token.");
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
  phaseLabelEl.textContent = phaseLabel();
  finalScoreEl.textContent = String(score.total);
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
  resetTurnBtn.disabled = state.gameOver || !state.turnStartSnapshot;

  renderMarket();
  renderBoard();
  renderEventLog();
}

function restartGame() {
  state.tiles = new Map();
  placeStarterTriangle();
  state.market = [];
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

  state.market.forEach((_, index) => {
    replaceTokenAtIndex(index);
  });
  addEventLog("All market tokens were rerolled while keeping the current tile hexes.");

  while (forceMarketQuadRefresh()) {
    addEventLog("Quad-token market refresh triggered after reroll.");
  }

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

restartGame();
