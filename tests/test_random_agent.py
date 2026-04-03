import json
import unittest

from agents.random_agent import play_random_game
from cascadia_engine import CascadiaEngine


class RandomAgentTests(unittest.TestCase):
    def test_random_agent_finishes_game_and_exports_log(self):
        engine, log_text = play_random_game(
            data_js_path="data.js",
            game_seed=11,
            agent_seed=99,
            max_turns=6,
            starter_set_index=0,
        )
        self.assertTrue(engine.state.game_over)
        payload = json.loads(log_text)
        self.assertEqual(len(payload["entries"]), 6)

        replay = CascadiaEngine.from_legacy_data_js("data.js", seed=0, max_turns=6)
        replay.replay_log(log_text)
        self.assertEqual(engine.encode_state(), replay.encode_state())


if __name__ == "__main__":
    unittest.main()
