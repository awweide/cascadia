import json
import unittest

from agents.trainable_agent import FIXED_SCORING_CARDS, evaluate_policy, run_trained_agent, train_policy
from cascadia_engine import CascadiaEngine


class TrainableAgentTests(unittest.TestCase):
    def test_training_produces_policy_and_5_turn_game(self):
        weights, history = train_policy(
            data_js_path="data.js",
            train_steps=2,
            episodes_per_step=3,
            game_seed_base=100,
            train_seed=17,
        )
        self.assertEqual(len(weights), 12)
        self.assertEqual(len(history), 2)
        self.assertIn("mean_reward", history[0])
        self.assertIn("best_reward", history[0])

        engine, score = run_trained_agent(
            data_js_path="data.js",
            game_seed=77,
            weights=weights,
            actor_seed=5,
        )
        self.assertTrue(engine.state.game_over)
        self.assertEqual(engine.state.max_turns, 5)
        payload = json.loads(engine.export_log())
        self.assertEqual(len(payload["entries"]), 5)
        self.assertGreaterEqual(score, 0)
        custom_score = engine.score(scoring_cards=FIXED_SCORING_CARDS)["total"]
        self.assertEqual(int(score), custom_score)

    def test_score_supports_explicit_scoring_cards(self):
        engine = CascadiaEngine.from_legacy_data_js("data.js", seed=19, max_turns=5)
        engine.reset()
        baseline = engine.score()["total"]
        configured = engine.score(scoring_cards=FIXED_SCORING_CARDS)["total"]
        self.assertIsInstance(configured, int)
        self.assertGreaterEqual(configured, 0)
        self.assertGreaterEqual(baseline, 0)

    def test_evaluate_policy_reports_summary_stats(self):
        report = evaluate_policy(
            data_js_path="data.js",
            weights=[0.0] * 12,
            episodes=3,
            game_seed_base=500,
            actor_seed_base=900,
        )
        self.assertEqual(report["episodes"], 3)
        self.assertEqual(len(report["scores"]), 3)
        self.assertGreaterEqual(report["max_score"], report["min_score"])


if __name__ == "__main__":
    unittest.main()
