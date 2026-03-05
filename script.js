const GRID_SIZE = 5;
const TURNS_TOTAL = 20;

const terrains = ["forest", "river", "mountain", "prairie", "wetland"];
const wildlife = ["🦌", "🦊", "🐻", "🦅", "🐟"];

const state = {
  board: createEmptyBoard(),
  score: 0,
  turn: 1,
  market: [],
  selectedMarketIndex: null,
  gameOver: false,
};

const turnCounterEl = document.getElementById("turn-counter");
const marketTilesEl = document.getElementById("market-tiles");
const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart-btn");
const boardEl = document.getElementById("board");

function createEmptyBoard() {
  return Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => null));
}

function drawTile() {
  return {
    terrain: terrains[Math.floor(Math.random() * terrains.length)],
    wildlife: wildlife[Math.floor(Math.random() * wildlife.length)],
  };
}

function refillMarketToFour() {
  while (state.market.length < 4) {
    state.market.push(drawTile());
  }
}

function initBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.addEventListener("click", onBoardCellClick);
      boardEl.appendChild(cell);
    }
  }
}

function renderBoard() {
  Array.from(boardEl.children).forEach((cellEl) => {
    const row = Number(cellEl.dataset.row);
    const col = Number(cellEl.dataset.col);
    const tile = state.board[row][col];

    if (!tile) {
      cellEl.className = "cell";
      cellEl.textContent = "";
      cellEl.title = "";
      return;
    }

    cellEl.className = `cell filled terrain-${tile.terrain}`;
    cellEl.textContent = tile.wildlife;
    cellEl.title = `${tile.terrain} ${tile.wildlife}`;
  });
}

function renderMarket() {
  marketTilesEl.innerHTML = "";
  state.market.forEach((tile, index) => {
    const tileEl = document.createElement("button");
    tileEl.type = "button";
    tileEl.className = `tile terrain-${tile.terrain}`;

    if (state.selectedMarketIndex === index) {
      tileEl.classList.add("selected");
    }

    tileEl.innerHTML = `<div><strong>${tile.terrain}</strong></div><div style="font-size:1.2rem;">${tile.wildlife}</div>`;
    tileEl.addEventListener("click", () => {
      if (state.gameOver) return;
      state.selectedMarketIndex = index;
      setStatus(`Selected ${tile.terrain} ${tile.wildlife}. Place it on an empty board cell.`);
      render();
    });

    marketTilesEl.appendChild(tileEl);
  });
}

function setStatus(message) {
  statusEl.textContent = message;
}

function adjacentPositions(row, col) {
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ].filter(([r, c]) => r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE);
}

function scorePlacement(row, col, tile) {
  let points = 0;
  adjacentPositions(row, col).forEach(([r, c]) => {
    const neighbor = state.board[r][c];
    if (!neighbor) return;
    if (neighbor.terrain === tile.terrain) points += 1;
    if (neighbor.wildlife === tile.wildlife) points += 1;
  });
  return points;
}

function discardRandomMarketPair() {
  if (state.market.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * state.market.length);
  const [discarded] = state.market.splice(randomIndex, 1);
  return discarded;
}

function onBoardCellClick(event) {
  if (state.gameOver) return;

  const cell = event.currentTarget;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);

  if (state.selectedMarketIndex === null) {
    setStatus("Select a tile+token pair from the market first.");
    return;
  }

  if (state.board[row][col] !== null) {
    setStatus("That cell is already occupied.");
    return;
  }

  const [chosenTile] = state.market.splice(state.selectedMarketIndex, 1);
  state.selectedMarketIndex = null;

  state.board[row][col] = chosenTile;
  const gained = scorePlacement(row, col, chosenTile);
  state.score += gained;

  const discarded = discardRandomMarketPair();
  refillMarketToFour();

  if (state.turn >= TURNS_TOTAL) {
    state.gameOver = true;
    setStatus(`Game over! Final score: ${state.score}.`);
  } else {
    state.turn += 1;
    if (discarded) {
      setStatus(
        `Placed ${chosenTile.terrain} ${chosenTile.wildlife} (+${gained}). Random discard: ${discarded.terrain} ${discarded.wildlife}.`
      );
    } else {
      setStatus(`Placed ${chosenTile.terrain} ${chosenTile.wildlife} (+${gained}).`);
    }
  }

  render();
}

function render() {
  turnCounterEl.textContent = `${Math.min(state.turn, TURNS_TOTAL)} / ${TURNS_TOTAL}`;
  scoreEl.textContent = String(state.score);
  renderBoard();
  renderMarket();
}

function restartGame() {
  state.board = createEmptyBoard();
  state.score = 0;
  state.turn = 1;
  state.market = [];
  state.selectedMarketIndex = null;
  state.gameOver = false;

  refillMarketToFour();
  setStatus("New solo game started. Choose a tile pair to begin.");
  render();
}

restartBtn.addEventListener("click", restartGame);

initBoard();
restartGame();
