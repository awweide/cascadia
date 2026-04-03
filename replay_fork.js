(function () {
  const logInputEl = document.getElementById("log-input");
  const loadLogBtn = document.getElementById("load-log-btn");
  const loadExampleBtn = document.getElementById("load-example-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const turnLabelEl = document.getElementById("turn-label");
  const boardListEl = document.getElementById("board-list");
  const marketListEl = document.getElementById("market-list");
  const actionJsonEl = document.getElementById("action-json");

  let entries = [];
  let cursor = 0;
  const BUNDLED_EXAMPLE_LOG = "examples/random_agent_seed42_7_log.json";

  function render() {
    if (entries.length === 0) {
      turnLabelEl.textContent = "Turn: -";
      boardListEl.innerHTML = "";
      marketListEl.innerHTML = "";
      actionJsonEl.textContent = "";
      return;
    }

    const entry = entries[cursor];
    const s = entry.state;
    turnLabelEl.textContent = `Turn: ${s.turn} (${cursor + 1}/${entries.length})`;

    boardListEl.innerHTML = (s.board || [])
      .map((tile) => {
        const coord = `${tile.coord[0]},${tile.coord[1]}`;
        const terrain = (tile.terrains || []).join("/");
        const printed = (tile.printed_animals || []).join("");
        return `<li>${coord} :: ${tile.id} :: ${terrain} :: r${tile.rotation} :: printed=[${printed}] :: token=${tile.token || "-"}</li>`;
      })
      .join("");

    marketListEl.innerHTML = (s.market || [])
      .map((pair, idx) => `<li>${idx}: ${pair.tile_id} | ${pair.kind} | ${pair.terrains.join("/")} | token=${pair.token}</li>`)
      .join("");

    actionJsonEl.textContent = JSON.stringify(entry.input, null, 2);
    prevBtn.disabled = cursor <= 0;
    nextBtn.disabled = cursor >= entries.length - 1;
  }

  loadLogBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(logInputEl.value);
      entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      cursor = 0;
      render();
    } catch (err) {
      alert(`Invalid JSON logfile: ${err.message}`);
    }
  });

  loadExampleBtn.addEventListener("click", async () => {
    try {
      const response = await fetch(BUNDLED_EXAMPLE_LOG);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payloadText = await response.text();
      logInputEl.value = payloadText;
      const parsed = JSON.parse(payloadText);
      entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      cursor = 0;
      render();
    } catch (err) {
      alert(`Failed to load bundled example logfile: ${err.message}`);
    }
  });

  prevBtn.addEventListener("click", () => {
    if (cursor > 0) {
      cursor -= 1;
      render();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (cursor < entries.length - 1) {
      cursor += 1;
      render();
    }
  });

  render();
})();
