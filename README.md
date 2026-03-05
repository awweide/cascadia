# Mini Cascadia (Solo Browser Game)

A simple, mouse-based, turn-based solo game inspired by Cascadia.

## Run

Open `index.html` directly in a browser, or serve locally:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Solo Rules (Simplified)

- Game lasts exactly 20 turns.
- On each turn, select one tile+token pair from the market and place it on an empty board cell.
- Score `+1` for each orthogonally adjacent tile with matching terrain.
- Score `+1` for each orthogonally adjacent tile with matching wildlife icon.
- After each placement, one random remaining market pair is discarded, then market refills to 4.
- Try to maximize your final score.
