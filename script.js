const FULL_TURNS = 20;
const FAST_TURNS = 6;
const HEX_SIZE = 54;

const terrains = ["forest", "river", "mountain", "prairie", "wetland"];
const animals = ["🦌", "🦊", "🐻", "🦅", "🐟"];
const terrainColors = {
  forest: "#d2e9d0",
  river: "#cfe8ff",
  mountain: "#e3ddda",
  prairie: "#f7efc3",
  wetland: "#d5f1e2",
};

const axialDirections = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

const state = {
  tiles: new Map(),
  market: [],
  selectedPairIndex: null,
  selectedPair: null,
  pendingRotation: 0,
  turn: 1,
  maxTurns: FULL_TURNS,
  modeName: "Full (20 turns)",
  phase: "pickPair",
  gameOver: false,
  finalScore: null,
};

const modeLabelEl = document.getElementById("mode-label");
const turnCounterEl = document.getElementById("turn-counter");
const phaseLabelEl = document.getElementById("phase-label");
const finalScoreEl = document.getElementById("final-score");
const marketTilesEl = document.getElementById("market-tiles");
const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart-btn");
const modeFullBtn = document.getElementById("mode-full-btn");
const modeFastBtn = document.getElementById("mode-fast-btn");
const rotateLeftBtn = document.getElementById("rotate-left-btn");
const rotateRightBtn = document.getElementById("rotate-right-btn");

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

function randomDistinctAnimals() {
  const first = randomItem(animals);
  let second = randomItem(animals);
  while (second === first) second = randomItem(animals);
  return [first, second];
}

function randomDistinctTerrains() {
  const first = randomItem(terrains);
  let second = randomItem(terrains);
  while (second === first) second = randomItem(terrains);
  return [first, second];
}

function drawDraftTile() {
  const split = Math.random() < 0.75;
  if (split) {
    const [terrainA, terrainB] = randomDistinctTerrains();
    return {
      kind: "split",
      terrainA,
      terrainB,
      printedAnimals: randomDistinctAnimals(),
    };
  }

  return {
    kind: "single",
    terrain: randomItem(terrains),
    printedAnimals: randomDistinctAnimals(),
  };
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
      printedAnimals: tileDraft.printedAnimals,
      token: null,
      starter: false,
      rotation,
      terrainsPresent: [tileDraft.terrain],
      edges: Array(6).fill(tileDraft.terrain),
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
    printedAnimals: tileDraft.printedAnimals,
    token: null,
    starter: false,
    rotation,
    terrainsPresent: [tileDraft.terrainA, tileDraft.terrainB],
    edges,
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
    { q: 0, r: 0, tile: { kind: "single", terrain: "forest", printedAnimals: ["🦌", "🦊"] }, token: null },
    {
      q: 1,
      r: 0,
      tile: { kind: "split", terrainA: "river", terrainB: "wetland", printedAnimals: ["🐟", "🦅"] },
      token: null,
    },
    {
      q: 0,
      r: 1,
      tile: { kind: "split", terrainA: "mountain", terrainB: "prairie", printedAnimals: ["🐻", "🦌"] },
      token: null,
    },
  ];

  starterTiles.forEach((starter) => {
    const built = tileFromDraft(starter.tile, 0);
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

function discardRandomMarketPair() {
  if (state.market.length === 0) return null;
  const index = Math.floor(Math.random() * state.market.length);
  const [discarded] = state.market.splice(index, 1);
  return discarded;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function phaseLabel() {
  if (state.gameOver) return "Game Over";
  if (state.phase === "pickPair") return "Pick a pair";
  if (state.phase === "placeTile") return `Place tile (rotation ${state.pendingRotation * 60}°)`;
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

  const angle = tile.rotation * 60 - 30;
  const cA = terrainColors[tile.terrainA];
  const cB = terrainColors[tile.terrainB];
  return `conic-gradient(from ${angle}deg, ${cA} 0deg 180deg, ${cB} 180deg 360deg)`;
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

  function drawHex(q, r, tile, isOpen) {
    const hex = document.createElement("button");
    hex.type = "button";
    hex.className = "hex";
    const { x, y } = axialToPixel(q, r);
    hex.style.left = `${x - minX + padding}px`;
    hex.style.top = `${y - minY + padding}px`;
    hex.dataset.q = String(q);
    hex.dataset.r = String(r);

    if (isOpen) {
      hex.classList.add("open");
      hex.textContent = "+";
    } else {
      hex.classList.add("filled");
      if (tile.starter) hex.classList.add("starter");
      hex.style.background = tileBackground(tile);
      if (tile.token) {
        hex.innerHTML = `<span class="hex-token">${tile.token}</span>`;
      } else {
        hex.innerHTML = `<span class="hex-animals">${tile.printedAnimals.join(" ")}</span>`;
      }
      hex.title = tile.kind === "single"
        ? `${tile.terrain} | printed: ${tile.printedAnimals.join(", ")} | token: ${tile.token ?? "none"}`
        : `${tile.terrainA}/${tile.terrainB} (rot ${tile.rotation * 60}°) | printed: ${tile.printedAnimals.join(", ")} | token: ${tile.token ?? "none"}`;
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

function marketTileHexHTML(pair) {
  const tile = tileFromDraft(pair.tileDraft, 0);
  const bg = tileBackground(tile);
  return `<div class="hex market-hex" style="background:${bg};"></div>`;
}

function renderMarket() {
  marketTilesEl.innerHTML = "";
  state.market.forEach((pair, index) => {
    const pairEl = document.createElement("button");
    pairEl.type = "button";
    pairEl.className = "pair";
    if (state.selectedPairIndex === index) pairEl.classList.add("selected");

    pairEl.innerHTML = `
      <div>${marketTileHexHTML(pair)}</div>
      <div class="token-row">
        <span class="market-token">${pair.tileDraft.printedAnimals[0]}</span>
        <span class="market-token">${pair.tileDraft.printedAnimals[1]}</span>
        <span class="market-token pick">${pair.token}</span>
      </div>
    `;

    pairEl.addEventListener("click", () => {
      if (state.gameOver) return;
      if (state.phase !== "pickPair") {
        setStatus("Finish placing your current tile/token before picking a new pair.");
        return;
      }
      state.selectedPairIndex = index;
      state.selectedPair = state.market[index];
      state.pendingRotation = 0;
      state.phase = "placeTile";
      setStatus("Pair selected. Place tile on an open adjacent hex (rotate if needed).");
      render();
    });

    marketTilesEl.appendChild(pairEl);
  });
}

function tileContainsTerrain(tile, terrainType) {
  return tile.terrainsPresent.includes(terrainType);
}

function tilesConnectedForTerrain(coordKeyA, coordKeyB, directionIndex, terrainType) {
  const tileA = state.tiles.get(coordKeyA);
  const tileB = state.tiles.get(coordKeyB);
  if (!tileA || !tileB) return false;
  if (!tileContainsTerrain(tileA, terrainType) || !tileContainsTerrain(tileB, terrainType)) return false;

  const opposite = (directionIndex + 3) % 6;
  return tileA.edges[directionIndex] === terrainType && tileB.edges[opposite] === terrainType;
}

function largestConnectedTerrainGroup(terrainType) {
  const visited = new Set();
  let best = 0;

  for (const [coordKey, tile] of state.tiles.entries()) {
    if (visited.has(coordKey)) continue;
    if (!tileContainsTerrain(tile, terrainType)) continue;

    let size = 0;
    const stack = [coordKey];
    visited.add(coordKey);

    while (stack.length) {
      const current = stack.pop();
      size += 1;
      const { q, r } = parseKey(current);

      axialDirections.forEach(([dq, dr], directionIndex) => {
        const neighborKey = key(q + dq, r + dr);
        if (visited.has(neighborKey)) return;
        if (!tilesConnectedForTerrain(current, neighborKey, directionIndex, terrainType)) return;
        visited.add(neighborKey);
        stack.push(neighborKey);
      });
    }

    best = Math.max(best, size);
  }

  return best;
}

function largestConnectedAnimalGroup(animalType) {
  const visited = new Set();
  let best = 0;

  for (const [coordKey, tile] of state.tiles.entries()) {
    if (visited.has(coordKey)) continue;
    if (tile.token !== animalType) continue;

    let size = 0;
    const stack = [coordKey];
    visited.add(coordKey);

    while (stack.length) {
      const current = stack.pop();
      size += 1;
      const { q, r } = parseKey(current);
      neighboringKeys(q, r).forEach((neighborKey) => {
        if (visited.has(neighborKey)) return;
        const neighborTile = state.tiles.get(neighborKey);
        if (!neighborTile || neighborTile.token !== animalType) return;
        visited.add(neighborKey);
        stack.push(neighborKey);
      });
    }

    best = Math.max(best, size);
  }

  return best;
}

function computeFinalScore() {
  let terrainTotal = 0;
  let animalTotal = 0;

  terrains.forEach((terrain) => {
    terrainTotal += largestConnectedTerrainGroup(terrain);
  });

  animals.forEach((animal) => {
    animalTotal += largestConnectedAnimalGroup(animal);
  });

  return {
    terrainTotal,
    animalTotal,
    total: terrainTotal + animalTotal,
  };
}

function finishTurn(chosenPair, placedToken, discardedTokenReason) {
  const randomDiscard = discardRandomMarketPair();
  refillMarketToFour();

  if (state.turn >= state.maxTurns) {
    state.gameOver = true;
    state.phase = "gameOver";
    state.finalScore = computeFinalScore();
    setStatus(
      `Game over! Terrain ${state.finalScore.terrainTotal} + Animal ${state.finalScore.animalTotal} = ${state.finalScore.total}.`
    );
  } else {
    state.turn += 1;
    state.phase = "pickPair";
    if (discardedTokenReason) {
      setStatus(
        `Placed tile. Token ${chosenPair.token} discarded (${discardedTokenReason}). Random market discard: ${randomDiscard ? randomDiscard.token : "none"}.`
      );
    } else {
      setStatus(
        `Placed tile and token ${placedToken}. Random market discard: ${randomDiscard ? randomDiscard.token : "none"}.`
      );
    }
  }

  state.selectedPair = null;
  state.selectedPairIndex = null;
  state.pendingRotation = 0;
  render();
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

    if (!canPlaceTokenAnywhere(state.selectedPair.token)) {
      finishTurn(state.selectedPair, null, "no legal tile for token");
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
  setStatus(`Rotation set to ${state.pendingRotation * 60}° for the selected tile.`);
  render();
}

function render() {
  modeLabelEl.textContent = state.modeName;
  turnCounterEl.textContent = `${Math.min(state.turn, state.maxTurns)} / ${state.maxTurns}`;
  phaseLabelEl.textContent = phaseLabel();
  finalScoreEl.textContent = state.finalScore ? String(state.finalScore.total) : "-";
  renderMarket();
  renderBoard();
}

function restartGame(turns) {
  if (turns === FAST_TURNS) {
    state.maxTurns = FAST_TURNS;
    state.modeName = "Fast (6 turns)";
  } else {
    state.maxTurns = FULL_TURNS;
    state.modeName = "Full (20 turns)";
  }

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
  state.finalScore = null;

  setStatus("New game started. Pick a pair, place tile first, then token.");
  render();
}

restartBtn.addEventListener("click", () => restartGame(state.maxTurns));
modeFullBtn.addEventListener("click", () => restartGame(FULL_TURNS));
modeFastBtn.addEventListener("click", () => restartGame(FAST_TURNS));
rotateLeftBtn.addEventListener("click", () => rotatePending(-1));
rotateRightBtn.addEventListener("click", () => rotatePending(1));

restartGame(FULL_TURNS);
