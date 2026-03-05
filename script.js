const FULL_TURNS = 20;
const FAST_TURNS = 6;
const HEX_SIZE = 54;

const terrains = ["forest", "river", "mountain", "prairie", "wetland"];
const animals = ["🦌", "🦊", "🐻", "🦅", "🐟"];
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
  placedTileCoord: null,
  turn: 1,
  maxTurns: FULL_TURNS,
  modeName: "Full (20 turns)",
  phase: "pickPair",
  gameOver: false,
};

const modeLabelEl = document.getElementById("mode-label");
const turnCounterEl = document.getElementById("turn-counter");
const phaseLabelEl = document.getElementById("phase-label");
const marketTilesEl = document.getElementById("market-tiles");
const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart-btn");
const modeFullBtn = document.getElementById("mode-full-btn");
const modeFastBtn = document.getElementById("mode-fast-btn");

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

function drawPair() {
  return {
    tile: {
      terrain: randomItem(terrains),
      printedAnimals: randomDistinctAnimals(),
    },
    token: randomItem(animals),
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
  const starterCoords = [
    { q: 0, r: 0, terrain: "forest", printedAnimals: ["🦌", "🦊"] },
    { q: 1, r: 0, terrain: "river", printedAnimals: ["🐟", "🦅"] },
    { q: 0, r: 1, terrain: "mountain", printedAnimals: ["🐻", "🦌"] },
  ];

  starterCoords.forEach((tile) => {
    state.tiles.set(key(tile.q, tile.r), {
      terrain: tile.terrain,
      printedAnimals: tile.printedAnimals,
      token: null,
      starter: true,
    });
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
  if (state.phase === "placeTile") return "Place tile";
  return "Place token";
}

function axialToPixel(q, r) {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
  const y = HEX_SIZE * 1.5 * r;
  return { x, y };
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
  const width = Math.max(500, maxX - minX + padding * 2);
  const height = Math.max(380, maxY - minY + padding * 2 + HEX_SIZE);
  boardEl.style.width = `${width}px`;
  boardEl.style.height = `${height}px`;

  const openKeys = new Set(openPlacementKeys());

  const drawHex = (q, r, tile, isOpen) => {
    const hex = document.createElement("button");
    hex.type = "button";
    hex.className = "hex";
    const { x, y } = axialToPixel(q, r);
    const left = x - minX + padding;
    const top = y - minY + padding;
    hex.style.left = `${left}px`;
    hex.style.top = `${top}px`;
    hex.dataset.q = String(q);
    hex.dataset.r = String(r);

    if (isOpen) {
      hex.classList.add("open");
      hex.textContent = "+";
      hex.addEventListener("click", onBoardHexClick);
    } else {
      hex.classList.add("filled", `terrain-${tile.terrain}`);
      if (tile.starter) hex.classList.add("starter");
      const tokenText = tile.token ? `<span class="hex-token">${tile.token}</span>` : "<span class=\"hex-token\">·</span>";
      hex.innerHTML = `${tokenText}<span class="hex-animals">${tile.printedAnimals.join(" ")}</span>`;
      hex.title = `${tile.terrain} | printed: ${tile.printedAnimals.join(", ")} | token: ${tile.token ?? "none"}`;
      hex.addEventListener("click", onBoardHexClick);
    }

    boardEl.appendChild(hex);
  };

  for (const [coordKey, tile] of state.tiles.entries()) {
    const { q, r } = parseKey(coordKey);
    drawHex(q, r, tile, false);
  }

  openKeys.forEach((coordKey) => {
    const { q, r } = parseKey(coordKey);
    drawHex(q, r, null, true);
  });
}

function renderMarket() {
  marketTilesEl.innerHTML = "";
  state.market.forEach((pair, index) => {
    const pairEl = document.createElement("button");
    pairEl.type = "button";
    pairEl.className = `pair terrain-${pair.tile.terrain}`;
    if (state.selectedPairIndex === index) pairEl.classList.add("selected");
    pairEl.innerHTML = `
      <div><strong>Terrain:</strong> ${pair.tile.terrain}</div>
      <div class="pair-row"><strong>Printed animals:</strong> ${pair.tile.printedAnimals.join(" ")}</div>
      <div class="pair-row"><strong>Token:</strong> ${pair.token}</div>
    `;

    pairEl.addEventListener("click", () => {
      if (state.gameOver) return;
      if (state.phase !== "pickPair") {
        setStatus("Finish placing your current tile/token before picking a new pair.");
        return;
      }
      state.selectedPairIndex = index;
      state.selectedPair = state.market[index];
      state.phase = "placeTile";
      setStatus(`Pair selected. Place the ${pair.tile.terrain} tile on an open adjacent hex.`);
      render();
    });

    marketTilesEl.appendChild(pairEl);
  });
}

function finishTurn(chosenPair, placedToken, discardedTokenReason) {
  const randomDiscard = discardRandomMarketPair();
  refillMarketToFour();

  if (state.turn >= state.maxTurns) {
    state.gameOver = true;
    state.phase = "gameOver";
    const result = computeFinalScore();
    setStatus(
      `Game over! Final score ${result.total}. Terrain ${result.terrainTotal} + Animal ${result.animalTotal}. ${result.detail}`
    );
  } else {
    state.turn += 1;
    state.phase = "pickPair";
    if (discardedTokenReason) {
      setStatus(
        `Placed ${chosenPair.tile.terrain}. Token ${chosenPair.token} discarded (${discardedTokenReason}). Random market discard: ${randomDiscard ? randomDiscard.tile.terrain + " " + randomDiscard.token : "none"}.`
      );
    } else {
      setStatus(
        `Placed ${chosenPair.tile.terrain} and token ${placedToken}. Random market discard: ${randomDiscard ? randomDiscard.tile.terrain + " " + randomDiscard.token : "none"}.`
      );
    }
  }

  state.selectedPair = null;
  state.selectedPairIndex = null;
  state.placedTileCoord = null;
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

    state.tiles.set(coordKey, {
      terrain: state.selectedPair.tile.terrain,
      printedAnimals: state.selectedPair.tile.printedAnimals,
      token: null,
      starter: false,
    });
    state.placedTileCoord = coordKey;
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
    if (!state.tiles.has(coordKey)) {
      setStatus("Token can only be placed on an existing tile.");
      return;
    }
    const tile = state.tiles.get(coordKey);
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
    return;
  }

  setStatus("Select a pair from the market to start your turn.");
}

function largestConnectedForType(getTypeValue, typeValue) {
  const visited = new Set();
  let best = 0;

  for (const [coordKey, tile] of state.tiles.entries()) {
    if (visited.has(coordKey)) continue;
    if (getTypeValue(tile) !== typeValue) continue;

    const stack = [coordKey];
    visited.add(coordKey);
    let size = 0;

    while (stack.length) {
      const current = stack.pop();
      size += 1;
      const { q, r } = parseKey(current);
      neighboringKeys(q, r).forEach((neighborKey) => {
        if (visited.has(neighborKey)) return;
        const neighborTile = state.tiles.get(neighborKey);
        if (!neighborTile) return;
        if (getTypeValue(neighborTile) !== typeValue) return;
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
  const terrainParts = [];
  const animalParts = [];

  terrains.forEach((terrain) => {
    const score = largestConnectedForType((tile) => tile.terrain, terrain);
    terrainTotal += score;
    terrainParts.push(`${terrain}:${score}`);
  });

  animals.forEach((animal) => {
    const score = largestConnectedForType((tile) => tile.token, animal);
    animalTotal += score;
    animalParts.push(`${animal}:${score}`);
  });

  return {
    terrainTotal,
    animalTotal,
    total: terrainTotal + animalTotal,
    detail: `Terrain groups [${terrainParts.join(" ")}], Animal groups [${animalParts.join(" ")}].`,
  };
}

function render() {
  modeLabelEl.textContent = state.modeName;
  turnCounterEl.textContent = `${Math.min(state.turn, state.maxTurns)} / ${state.maxTurns}`;
  phaseLabelEl.textContent = phaseLabel();
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
  state.placedTileCoord = null;
  state.turn = 1;
  state.phase = "pickPair";
  state.gameOver = false;

  setStatus("New game started. Pick a pair, place tile first, then token.");
  render();
}

restartBtn.addEventListener("click", () => restartGame(state.maxTurns));
modeFullBtn.addEventListener("click", () => restartGame(FULL_TURNS));
modeFastBtn.addEventListener("click", () => restartGame(FAST_TURNS));

restartGame(FULL_TURNS);
