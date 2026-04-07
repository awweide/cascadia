import unittest
import random
import json
import subprocess

from cascadia_engine import ANIMALS, CascadiaEngine


def _js_replay_initial_market(seed: int):
    # Mirrors replay normalization logic in script.js now that it uses
    # Python-compatible MT19937 random() semantics.
    engine = CascadiaEngine.from_legacy_data_js("data.js", seed=seed)
    rng = random.Random(seed)
    tile_bag = list(engine._tile_bag_source)
    rng.shuffle(tile_bag)
    animal_bag = [animal for animal in ANIMALS for _ in range(20)]
    rng.shuffle(animal_bag)

    market = []
    for _ in range(4):
        market.append((tile_bag.pop().id, animal_bag.pop()))
    return market


class EngineSynchronizationTests(unittest.TestCase):
    def test_script_seeded_rng_matches_python_random_sequence(self):
        script_text = open("script.js", "r", encoding="utf-8").read()
        marker = "function createSeededRng(seed) {"
        start = script_text.find(marker)
        self.assertNotEqual(start, -1)
        brace_depth = 0
        end = -1
        for idx in range(start, len(script_text)):
            char = script_text[idx]
            if char == "{":
                brace_depth += 1
            elif char == "}":
                brace_depth -= 1
                if brace_depth == 0:
                    end = idx + 1
                    break
        self.assertNotEqual(end, -1)
        function_src = script_text[start:end]

        seed = 42
        node_snippet = f"""{function_src}
const rng = createSeededRng({seed});
console.log(JSON.stringify([rng(), rng(), rng(), rng(), rng()]));
"""
        raw = subprocess.check_output(["node", "-e", node_snippet], text=True).strip()
        from_js = json.loads(raw)
        py_rng = random.Random(seed)
        from_python = [py_rng.random() for _ in range(5)]
        self.assertEqual(from_js, from_python)

    def test_python_and_js_replay_rngs_are_synchronized_for_same_seed(self):
        seed = 42
        engine = CascadiaEngine.from_legacy_data_js("data.js", seed=seed)
        engine.reset()
        python_market = [(pair.tile.id, pair.token) for pair in engine.state.market]
        js_replay_market = _js_replay_initial_market(seed)

        self.assertEqual(
            python_market,
            js_replay_market,
            "JS replay normalization should now match Python engine RNG behavior.",
        )

    def test_rng_alignment_happens_for_multiple_seeds(self):
        matches = 0
        for seed in range(10):
            engine = CascadiaEngine.from_legacy_data_js("data.js", seed=seed)
            engine.reset()
            python_market = [(pair.tile.id, pair.token) for pair in engine.state.market]
            js_replay_market = _js_replay_initial_market(seed)
            if python_market == js_replay_market:
                matches += 1

        self.assertEqual(matches, 10)


if __name__ == "__main__":
    unittest.main()
