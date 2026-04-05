from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from cascadia_engine import CascadiaEngine, MarketChoice, PlacementInput, TurnInput

FIXED_SCORING_CARDS = {
    "🐻": "A",
    "🦌": "C",
    "🐟": "A",
    "🦅": "A",
    "🦊": "A",
}


def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _legal_turns(engine: CascadiaEngine) -> list[TurnInput]:
    turns: list[TurnInput] = []
    open_coords = engine.open_coords()
    for pair_index, pair in enumerate(engine.state.market):
        base_token_spots = set(engine.legal_token_coords(pair.token))
        for q, r in open_coords:
            token_spots = set(base_token_spots)
            if pair.token in pair.tile.printed_animals:
                token_spots.add((q, r))
            token_choices = sorted(token_spots) if token_spots else [(None, None)]
            rotations = range(6) if pair.tile.kind == "split" else range(1)
            for rotation in rotations:
                for token_q, token_r in token_choices:
                    turns.append(
                        TurnInput(
                            manipulations=tuple(),
                            choice=MarketChoice(tile_index=pair_index, token_index=pair_index, is_mixed_pair=False),
                            placement=PlacementInput(q=q, r=r, rotation=rotation, token_q=token_q, token_r=token_r),
                        )
                    )
    return turns


def _animal_count(engine: CascadiaEngine, animal: str) -> int:
    return sum(1 for tile in engine.state.board.values() if tile.token == animal)


def _features_after_turn(engine: CascadiaEngine, turn_input: TurnInput) -> list[float]:
    probe = engine.clone()
    probe.apply_turn(turn_input)
    score = probe.score(scoring_cards=FIXED_SCORING_CARDS)
    turns_left = probe.state.max_turns - probe.state.turn + (0 if probe.state.game_over else 1)
    filled_tiles = sum(1 for tile in probe.state.board.values() if tile.token is not None)
    return [
        1.0,
        score["total"] / 100.0,
        score["terrain_total"] / 50.0,
        score["animal_total"] / 50.0,
        score["nature_token_points"] / 20.0,
        turns_left / max(1, probe.state.max_turns),
        filled_tiles / max(1, len(probe.state.board)),
        _animal_count(probe, "🐻") / 8.0,
        _animal_count(probe, "🦌") / 8.0,
        _animal_count(probe, "🐟") / 8.0,
        _animal_count(probe, "🦅") / 8.0,
        _animal_count(probe, "🦊") / 8.0,
    ]


def _select_turn(engine: CascadiaEngine, weights: list[float], rng: random.Random, explore_prob: float) -> TurnInput:
    legal_turns = _legal_turns(engine)
    if not legal_turns:
        raise RuntimeError("No legal turns available.")
    if rng.random() < explore_prob:
        return rng.choice(legal_turns)
    scored = []
    for turn_input in legal_turns:
        feat = _features_after_turn(engine, turn_input)
        scored.append((_dot(weights, feat), turn_input))
    scored.sort(key=lambda item: item[0], reverse=True)
    return scored[0][1]


def _play_episode(
    data_js_path: str,
    game_seed: int,
    policy_weights: list[float],
    actor_seed: int,
    explore_prob: float = 0.1,
) -> tuple[float, CascadiaEngine]:
    engine = CascadiaEngine.from_legacy_data_js(data_js_path, seed=game_seed, max_turns=5)
    engine.reset(starter_set_index=0)
    rng = random.Random(actor_seed)

    while not engine.state.game_over:
        turn_input = _select_turn(engine, policy_weights, rng=rng, explore_prob=explore_prob)
        engine.apply_turn(turn_input)

    total = float(engine.score(scoring_cards=FIXED_SCORING_CARDS)["total"])
    return total, engine


def train_policy(
    data_js_path: str,
    train_steps: int,
    episodes_per_step: int,
    game_seed_base: int,
    train_seed: int,
    sigma: float = 0.2,
    learning_rate: float = 0.12,
) -> tuple[list[float], list[dict]]:
    rng = random.Random(train_seed)
    feature_count = 12
    weights = [0.0 for _ in range(feature_count)]
    history: list[dict] = []

    for step in range(train_steps):
        perturbations: list[list[float]] = []
        rewards: list[float] = []
        for ep in range(episodes_per_step):
            eps = [rng.gauss(0.0, 1.0) for _ in range(feature_count)]
            candidate = [w + sigma * e for w, e in zip(weights, eps)]
            score, _ = _play_episode(
                data_js_path=data_js_path,
                game_seed=game_seed_base + (step * episodes_per_step) + ep,
                policy_weights=candidate,
                actor_seed=train_seed + 1000 + step * 131 + ep,
                explore_prob=0.2,
            )
            perturbations.append(eps)
            rewards.append(score)

        mean = sum(rewards) / len(rewards)
        best = max(rewards)
        history.append({"step": step + 1, "mean_reward": mean, "best_reward": best})
        variance = sum((value - mean) ** 2 for value in rewards) / len(rewards)
        std = math.sqrt(max(variance, 1e-12))
        for i in range(feature_count):
            grad = 0.0
            for eps, reward in zip(perturbations, rewards):
                normalized_reward = (reward - mean) / std
                grad += normalized_reward * eps[i]
            grad /= (episodes_per_step * sigma)
            weights[i] += learning_rate * grad

    return weights, history


def evaluate_policy(
    data_js_path: str,
    weights: list[float],
    episodes: int,
    game_seed_base: int,
    actor_seed_base: int,
) -> dict:
    scores: list[float] = []
    for idx in range(episodes):
        score, _ = _play_episode(
            data_js_path=data_js_path,
            game_seed=game_seed_base + idx,
            policy_weights=weights,
            actor_seed=actor_seed_base + idx,
            explore_prob=0.0,
        )
        scores.append(score)
    mean_score = sum(scores) / len(scores)
    return {
        "episodes": episodes,
        "mean_score": mean_score,
        "min_score": min(scores),
        "max_score": max(scores),
        "scores": scores,
    }


def run_trained_agent(
    data_js_path: str,
    game_seed: int,
    weights: list[float],
    actor_seed: int,
) -> tuple[CascadiaEngine, float]:
    score, engine = _play_episode(
        data_js_path=data_js_path,
        game_seed=game_seed,
        policy_weights=weights,
        actor_seed=actor_seed,
        explore_prob=0.0,
    )
    return engine, score


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a pure-Python, CPU-only proof-of-concept Cascadia agent.")
    parser.add_argument("--data", default="data.js", help="Path to legacy browser data.js")
    parser.add_argument("--train-steps", type=int, default=12, help="Number of policy-improvement steps")
    parser.add_argument("--episodes-per-step", type=int, default=10, help="Episodes per train step")
    parser.add_argument("--train-seed", type=int, default=123, help="RNG seed for training perturbations")
    parser.add_argument("--game-seed-base", type=int, default=2000, help="Base engine seed used during training")
    parser.add_argument("--eval-game-seed", type=int, default=42, help="Engine seed for final deterministic evaluation")
    parser.add_argument("--eval-actor-seed", type=int, default=314, help="Policy action seed for final evaluation")
    parser.add_argument("--weights-out", default="trainable_agent_weights.json", help="Where to save trained weights")
    parser.add_argument("--log-out", default="trainable_agent_game_log.json", help="Where to save the final replay logfile")
    parser.add_argument("--eval-episodes", type=int, default=12, help="Number of episodes for before/after training evaluation")
    args = parser.parse_args()

    baseline_weights = [0.0] * 12
    baseline_eval = evaluate_policy(
        data_js_path=args.data,
        weights=baseline_weights,
        episodes=args.eval_episodes,
        game_seed_base=args.game_seed_base + 50000,
        actor_seed_base=args.train_seed + 90000,
    )

    weights, history = train_policy(
        data_js_path=args.data,
        train_steps=args.train_steps,
        episodes_per_step=args.episodes_per_step,
        game_seed_base=args.game_seed_base,
        train_seed=args.train_seed,
    )
    trained_eval = evaluate_policy(
        data_js_path=args.data,
        weights=weights,
        episodes=args.eval_episodes,
        game_seed_base=args.game_seed_base + 80000,
        actor_seed_base=args.train_seed + 120000,
    )
    engine, score = run_trained_agent(
        data_js_path=args.data,
        game_seed=args.eval_game_seed,
        weights=weights,
        actor_seed=args.eval_actor_seed,
    )

    Path(args.weights_out).write_text(
        json.dumps(
            {
                "max_turns": 5,
                "scoring_cards": FIXED_SCORING_CARDS,
                "weights": weights,
                "training_history": history,
                "baseline_eval": baseline_eval,
                "trained_eval": trained_eval,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    Path(args.log_out).write_text(engine.export_log(scoring_cards=FIXED_SCORING_CARDS), encoding="utf-8")

    print(f"Saved weights: {args.weights_out}")
    print(f"Saved replay log: {args.log_out}")
    print(
        "Evaluation (mean score): "
        f"baseline={baseline_eval['mean_score']:.2f} -> trained={trained_eval['mean_score']:.2f}"
    )
    print(f"Final score (5-turn fixed-card setup): {score:.0f}")


if __name__ == "__main__":
    main()
