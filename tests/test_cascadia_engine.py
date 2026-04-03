import unittest

from cascadia_engine import CascadiaEngine, MarketChoice, PlacementInput, TurnInput


class EngineTests(unittest.TestCase):
    def test_seed_is_deterministic(self):
        a = CascadiaEngine.from_legacy_data_js("data.js", seed=7)
        b = CascadiaEngine.from_legacy_data_js("data.js", seed=7)
        a.reset()
        b.reset()
        self.assertEqual(a.encode_state(), b.encode_state())

    def test_invalid_non_adjacent_placement_rejected(self):
        engine = CascadiaEngine.from_legacy_data_js("data.js", seed=1)
        engine.reset()
        turn = TurnInput(
            manipulations=tuple(),
            choice=MarketChoice(tile_index=0, token_index=0, is_mixed_pair=False),
            placement=PlacementInput(q=5, r=5, rotation=0, token_q=None, token_r=None),
        )
        with self.assertRaises(ValueError):
            engine.apply_turn(turn)

    def test_log_replay_round_trip(self):
        engine = CascadiaEngine.from_legacy_data_js("data.js", seed=4)
        engine.reset()

        initial = engine.encode_state()
        open_coord = (2, -1)
        chosen_token = initial["market"][0]["token"]
        token_coord = None
        for tile in initial["board"]:
            if chosen_token in tile["printed_animals"] and tile["token"] is None:
                token_coord = tuple(tile["coord"])
                break
        self.assertIsNotNone(token_coord)
        turn = TurnInput(
            manipulations=tuple(),
            choice=MarketChoice(tile_index=0, token_index=0, is_mixed_pair=False),
            placement=PlacementInput(q=open_coord[0], r=open_coord[1], rotation=0, token_q=token_coord[0], token_r=token_coord[1]),
        )
        engine.apply_turn(turn)
        after_one = engine.encode_state()

        replay = CascadiaEngine.from_legacy_data_js("data.js", seed=999)
        replay.replay_log(engine.export_log())
        self.assertEqual(after_one, replay.encode_state())


if __name__ == "__main__":
    unittest.main()
