# Mini Cascadia (Solo Hex Browser Game)

A mouse-based, open-ended solo Cascadia-inspired game with rotatable split hexes.

## Run

Run directly in browser at <https://awweide.github.io/cascadia/>

Open `index.html` directly in a browser, or serve locally:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Python Engine (new)

A deterministic Python engine is available in `cascadia_engine.py` with a compact agent-friendly API:

- deterministic random seeds
- JS replay normalization uses the same seeded RNG behavior as the Python engine for compact action logs
- full game state encoding (`encode_state()` and `encode_state_text()`)
- move validation through `apply_turn(...)`
- end scoring with `score()`
- JSON action logging with `export_log()` (turn choices plus authoritative per-turn state snapshots for replay fidelity)
- log replay compatibility (`replay_log(...)`) so a game can be played back from an action logfile

Quick example:

```python
from cascadia_engine import CascadiaEngine, MarketChoice, PlacementInput, TurnInput

engine = CascadiaEngine.from_legacy_data_js("data.js", seed=42)
engine.reset()

turn = TurnInput(
    manipulations=tuple(),
    choice=MarketChoice(tile_index=0, token_index=0, is_mixed_pair=False),
    placement=PlacementInput(q=2, r=-1, rotation=0, token_q=0, token_r=0),
)
engine.apply_turn(turn)
print(engine.encode_state_text())
print(engine.score())
```

### Random legal-move agent

Run a full game with a deterministic random agent and produce a replay logfile:

```bash
python agents/random_agent.py --data data.js --game-seed 42 --agent-seed 7 --out random_agent_game_log.json
```

This writes a compact turn-choice logfile compatible with `engine.replay_log(...)`.

### Trainable proof-of-concept agent (pure Python, CPU only)

A simplified trainable agent is available in `agents/trainable_agent.py` with these fixed constraints:

- scoring cards are fixed to **Bear A, Elk C, Salmon A, Hawk A, Fox A**
- game length is fixed to **5 turns**
- training is pure Python (no third-party libraries, CPU only)

Example:

```bash
python agents/trainable_agent.py --data data.js --train-steps 12 --episodes-per-step 10 --weights-out trainable_agent_weights.json --log-out trainable_agent_game_log.json
```

This produces:

- a learned linear-policy weight file (`trainable_agent_weights.json`)
- a deterministic replay logfile from the trained policy (`trainable_agent_game_log.json`)
- simple before/after evaluation stats (baseline vs trained mean score across deterministic episodes), embedded in the weights JSON
- logfile metadata that captures game setup (`game_settings`, including scoring cards + starter tiles) and end-of-game score summary (`game_summary`, including terrain/animal subtotals)

Bundled example logfile in this repository:

- `examples/random_agent_seed42_7_log.json` (generated with `--game-seed 42 --agent-seed 7`)

### Replay playback in the main UI

Replay is now integrated directly into `index.html`:

1. Open `index.html`.
2. In **Game Setup**, set **Mode** to **Replay Logfile**.
3. Paste a logfile JSON or click **Load bundled example**.
4. Click **Start Replay**.
5. Use **Prev / Next** turn buttons to step through turns.

In replay mode, these **Prev / Next** controls are shown in the floating status bar beside the replay status text.

This supports older snapshot logs and compact version-2 Python engine logs.

## Modes

- **Full**: 20 turns.
- **Fast**: 6 turns (for quicker testing).

## Rules (Current Implementation)

- Board is open-ended hexes (no hard edge).
- A 3-hex starter triangle is pre-placed.
- Most market tiles are split (3/4 chance), half-and-half terrain split vertex-to-vertex.
- Split tiles support rotation in 60° steps before placement.
- Tile placement must be on an open hex adjacent to existing tiles.
- Each turn sequence:
  1. pick a tile+token pair,
  2. place the tile,
  3. place the token.
- Token placement is only legal on a tile with no token where that animal is printed.
- If the chosen token has no legal placement anywhere, it is discarded.
- After each turn, one random remaining market pair is discarded and market refills to 4.

## End Scoring

Scoring is computed only at game end:

- For each terrain type, score the size of its single largest connected group.
  - Split-hex connectivity is edge-aware: neighboring hexes connect only when the shared edge has the same terrain on both sides.
- Animal scoring uses species-specific rules:
  - **Bear (🐻)**: count connected bear groups of size exactly 2 (pairs). For 1/2/3/4+ pairs score 4/11/19/27.
  - **Elk (🦌)**: partition elk into non-overlapping straight lines to maximize score. A line of 1/2/3/4+ elk scores 2/5/9/13.
  - **Fox (🦊)**: each fox scores by number of unique adjacent animal types (including foxes): 1/2/3/4/5 unique types gives 1/2/3/4/5.
  - **Hawk (🦅)**: count isolated hawks (connected hawk groups of size 1). For 1/2/3/4/5/6/7/8+ isolated hawks score 2/5/8/11/14/18/22/26.
  - **Salmon (🐟)**: each connected salmon group scores only if every salmon in the group has 1 or 2 salmon neighbors in that same group; then group size 1/2/3/4/5/6/7+ scores 2/5/8/12/16/20/25.
- Final score = terrain subtotal + animal subtotal + bonus from occupied single-terrain market tiles.
