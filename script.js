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
  "🦌": "Deer",
  "🦊": "Fox",
  "🐻": "Bear",
  "🦅": "Hawk",
  "🐟": "Salmon",
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
        bonusOnToken: false,
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
  if (state.selectedPairIndex !== null && state.selectedPairIndex >= 0 && state.selectedPairIndex < state.market.length) {
    const [removed] = state.market.splice(state.selectedPairIndex, 1);
    if (removed === chosenPair) return removed;
    const fallbackIndex = state.market.indexOf(chosenPair);
    if (fallbackIndex >= 0) {
      const [fallbackRemoved] = state.market.splice(fallbackIndex, 1);
      return fallbackRemoved;
    }
    return removed;
  }

  const index = state.market.indexOf(chosenPair);
  if (index < 0) return null;
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

  const angle = tile.rotation * 60;
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
        hex.innerHTML = `<span class="hex-animals">${previewTile.printedAnimals.join(" ")}</span>`;
      } else {
        hex.classList.add("open");
        hex.textContent = "+";
      }
    } else {
      hex.classList.add("filled");
      if (tile.starter) hex.classList.add("starter");
      if (tile.bonusOnToken) hex.classList.add("bonus-tile");
      hex.style.background = tileBackground(tile);

      const showTokenPreview = state.hoverCoordKey === coordKey && hoverTokenIsLegal(coordKey);
      if (tile.token) {
        hex.innerHTML = `<span class="hex-token">${tile.token}</span>`;
      } else if (showTokenPreview) {
        hex.classList.add("token-preview");
        hex.innerHTML = `<span class="hex-token">${state.selectedPair.token}</span>`;
      } else {
        hex.innerHTML = `<span class="hex-animals">${tile.printedAnimals.join(" ")}</span>`;
      }

      if (tile.kind === "single") {
        const bonusText = tile.bonusOnToken ? " | +1 if token placed" : "";
        hex.title = `${tile.terrain} | printed: ${tile.printedAnimals.join(", ")} | token: ${tile.token ?? "none"}${bonusText}`;
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

function marketTileHexHTML(pair) {
  const tile = tileFromDraft(pair.tileDraft, 0);
  const bg = tileBackground(tile);
  const bonusBadge = pair.tileDraft.bonusOnToken ? '<span class="bonus-badge">+1 bonus when token placed</span>' : "";
  return `<div class="hex market-hex" style="background:${bg};"><span class="hex-animals">${pair.tileDraft.printedAnimals.join(" ")}</span></div>${bonusBadge}`;
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
        <span>Token:</span>
        <span class="market-token pick">${pair.token}</span>
      </div>
      <div class="pair-type">${pair.tileDraft.marketType ?? "starter"}</div>
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

function countBonusTilesWithTokens() {
  let bonus = 0;
  for (const tile of state.tiles.values()) {
    if (tile.bonusOnToken && tile.token) bonus += 1;
  }
  return bonus;
}

function computeScoreBreakdown() {
  const terrainScores = {};
  const animalScores = {};

  terrains.forEach((terrain) => {
    terrainScores[terrain] = largestConnectedTerrainGroup(terrain);
  });

  animals.forEach((animal) => {
    animalScores[animal] = largestConnectedAnimalGroup(animal);
  });

  const terrainTotal = terrains.reduce((sum, terrain) => sum + terrainScores[terrain], 0);
  const animalTotal = animals.reduce((sum, animal) => sum + animalScores[animal], 0);
  const bonusTotal = countBonusTilesWithTokens();

  return {
    terrainScores,
    animalScores,
    terrainTotal,
    animalTotal,
    bonusTotal,
    total: terrainTotal + animalTotal + bonusTotal,
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
      <div>
        <strong>Terrain contributions</strong>
        <ul>${terrainItems}</ul>
        <p class="score-subtotal">Terrain subtotal: ${score.terrainTotal}</p>
      </div>
      <div>
        <strong>Animal contributions</strong>
        <ul>${animalItems}</ul>
        <p class="score-subtotal">Animal subtotal: ${score.animalTotal}</p>
      </div>
    </div>
    <p class="score-subtotal">Bonus from occupied single-terrain/single-animal market tiles: ${score.bonusTotal}</p>
    <p class="score-total">Total = Terrain ${score.terrainTotal} + Animal ${score.animalTotal} + Bonus ${score.bonusTotal} = ${score.total}</p>
  `;
}

function finishTurn(chosenPair, placedToken, discardedTokenReason) {
  removePickedMarketPair(chosenPair);
  const leftmostDiscard = removeLeftmostMarketPair();
  refillMarketToFour();

  if (state.turn >= state.maxTurns) {
    state.gameOver = true;
    state.phase = "gameOver";
    state.score = computeScoreBreakdown();
    setStatus(
      `Game over! Terrain ${state.score.terrainTotal} + Animal ${state.score.animalTotal} + Bonus ${state.score.bonusTotal} = ${state.score.total}.`
    );
  } else {
    state.turn += 1;
    state.phase = "pickPair";
    if (discardedTokenReason) {
      setStatus(
        `Placed tile. Token ${chosenPair.token} discarded (${discardedTokenReason}). Removed chosen pair and leftmost remaining pair (${leftmostDiscard ? leftmostDiscard.token : "none"}) before refill.`
      );
    } else {
      setStatus(
        `Placed tile and token ${placedToken}. Removed chosen pair and leftmost remaining pair (${leftmostDiscard ? leftmostDiscard.token : "none"}) before refill.`
      );
    }
  }

  state.selectedPair = null;
  state.selectedPairIndex = null;
  state.pendingRotation = 0;
  state.hoverCoordKey = null;
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
  const score = computeScoreBreakdown();
  state.score = score;
  turnCounterEl.textContent = `${Math.min(state.turn, state.maxTurns)} / ${state.maxTurns}`;
  phaseLabelEl.textContent = phaseLabel();
  finalScoreEl.textContent = String(score.total);
  renderScoreBreakdown(score);
  renderMarket();
  renderBoard();
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

  setStatus("New game started. Pick a pair, place tile first, then token.");
  render();
}

restartBtn.addEventListener("click", restartGame);
rotateLeftBtn.addEventListener("click", () => rotatePending(-1));
rotateRightBtn.addEventListener("click", () => rotatePending(1));

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
