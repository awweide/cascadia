# Mini Cascadia (Solo Hex Browser Game)

A mouse-based, open-ended solo Cascadia-inspired game with rotatable split hexes.

## Run

Run directly in browser at <https://awweide.github.io/cascadia/>

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
- Animal scoring uses species-specific rules:
  - **Bear (🐻)**: count connected bear groups of size exactly 2 (pairs). For 1/2/3/4+ pairs score 4/11/19/27.
  - **Elk (🦌)**: partition elk into non-overlapping straight lines to maximize score. A line of 1/2/3/4+ elk scores 2/5/9/13.
  - **Fox (🦊)**: each fox scores by number of unique adjacent animal types (including foxes): 1/2/3/4/5 unique types gives 1/2/3/4/5.
  - **Hawk (🦅)**: count isolated hawks (connected hawk groups of size 1). For 1/2/3/4/5/6/7/8+ isolated hawks score 2/5/8/11/14/18/22/26.
  - **Salmon (🐟)**: each connected salmon group scores only if every salmon in the group has 1 or 2 salmon neighbors in that same group; then group size 1/2/3/4/5/6/7+ scores 2/5/8/12/16/20/25.
- Final score = terrain subtotal + animal subtotal + bonus from occupied single-terrain market tiles.
