# Mini Cascadia (Solo Hex Browser Game)

A mouse-based, open-ended solo Cascadia-inspired game with rotatable split hexes.

## Run

Open `index.html` directly in a browser, or serve locally:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

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
- For each animal token type, score the size of its single largest connected token group.
- Final score = terrain subtotal + animal subtotal.
