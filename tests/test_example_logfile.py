import json
import unittest
from pathlib import Path

from cascadia_engine import CascadiaEngine


class ExampleLogfileTests(unittest.TestCase):
    def test_bundled_example_log_replays(self):
        log_path = Path("examples/random_agent_seed42_7_log.json")
        payload = json.loads(log_path.read_text(encoding="utf-8"))
        self.assertEqual(payload.get("seed"), 42)
        self.assertEqual(len(payload.get("entries", [])), 20)

        engine = CascadiaEngine.from_legacy_data_js("data.js", seed=999, max_turns=20)
        engine.replay_log(log_path.read_text(encoding="utf-8"))
        self.assertTrue(engine.state.game_over)


if __name__ == "__main__":
    unittest.main()
