from __future__ import annotations

import argparse
from pathlib import Path
from random import Random
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from cascadia_engine import CascadiaEngine, MarketChoice, PlacementInput, TurnInput


def _choose_token_coord(engine: CascadiaEngine, chosen_token: str, chosen_tile_printed_animals: list[str], q: int, r: int, rng: Random):
    legal = set(engine.legal_token_coords(chosen_token))
    if chosen_token in chosen_tile_printed_animals:
        legal.add((q, r))
    if not legal:
        return None, None
    tq, tr = rng.choice(sorted(legal))
    return tq, tr


def play_random_game(data_js_path: str, game_seed: int, agent_seed: int, max_turns: int = 20, starter_set_index: int = 0) -> tuple[CascadiaEngine, str]:
    engine = CascadiaEngine.from_legacy_data_js(data_js_path, seed=game_seed, max_turns=max_turns)
    engine.reset(starter_set_index=starter_set_index)

    rng = Random(agent_seed)

    while not engine.state.game_over:
        pair_index = rng.randrange(len(engine.state.market))
        pair = engine.state.market[pair_index]

        q, r = rng.choice(engine.open_coords())
        rotation = rng.randrange(6)
        token_q, token_r = _choose_token_coord(
            engine=engine,
            chosen_token=pair.token,
            chosen_tile_printed_animals=list(pair.tile.printed_animals),
            q=q,
            r=r,
            rng=rng,
        )

        turn_input = TurnInput(
            manipulations=tuple(),
            choice=MarketChoice(tile_index=pair_index, token_index=pair_index, is_mixed_pair=False),
            placement=PlacementInput(q=q, r=r, rotation=rotation, token_q=token_q, token_r=token_r),
        )

        # Random play should usually be legal; if not, resample this turn.
        try:
            engine.apply_turn(turn_input)
        except ValueError:
            continue

    return engine, engine.export_log()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a random legal-move agent for the Cascadia Python engine.")
    parser.add_argument("--data", default="data.js", help="Path to legacy browser data.js")
    parser.add_argument("--game-seed", type=int, default=42, help="Deterministic seed for engine RNG")
    parser.add_argument("--agent-seed", type=int, default=7, help="Deterministic seed for random agent decisions")
    parser.add_argument("--turns", type=int, default=20, help="Game turn count")
    parser.add_argument("--starter-set", type=int, default=0, help="Starter set index")
    parser.add_argument("--out", default="random_agent_game_log.json", help="Output logfile path")
    args = parser.parse_args()

    engine, log_text = play_random_game(
        data_js_path=args.data,
        game_seed=args.game_seed,
        agent_seed=args.agent_seed,
        max_turns=args.turns,
        starter_set_index=args.starter_set,
    )

    out_path = Path(args.out)
    out_path.write_text(log_text, encoding="utf-8")
    print(f"Wrote logfile: {out_path}")
    print(f"Final score: {engine.score()['total']}")


if __name__ == "__main__":
    main()
