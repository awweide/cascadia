# Mini Cascadia (Solo Hex Browser Game)

A simple, mouse-based, open-ended solo game inspired by Cascadia.

## Run

Open `index.html` directly in a browser, or serve locally:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Modes

- **Full**: 20 turns.
- **Fast**: 6 turns (for quicker testing).

## Rules (This Implementation)

- Board is open-ended hexes (no hard edge).
- A 3-hex starter triangle is pre-placed at game start.
- Each turn: pick one tile+token pair from market.
- Place the tile first on an open hex adjacent to any existing tile.
- Then place the token on any existing tile that:
  - has no token yet, and
  - has that token animal printed on the tile.
- If no legal tile exists for the chosen token, the token is discarded.
- After your turn, one random remaining market pair is discarded, and market refills to 4.

## End Scoring

Scoring happens only when the last turn ends:

- For each terrain type, find the **single largest connected group** and score its size.
- For each animal token type, find the **single largest connected group** of placed tokens and score its size.
- Final score is terrain subtotal + animal subtotal.
