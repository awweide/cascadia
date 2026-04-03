from __future__ import annotations

import json
import random
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

AXIAL_DIRECTIONS: Tuple[Tuple[int, int], ...] = (
    (1, -1),
    (1, 0),
    (0, 1),
    (-1, 1),
    (-1, 0),
    (0, -1),
)

TERRAINS = ("forest", "river", "mountain", "prairie", "wetland")
ANIMALS = ("🐻", "🦌", "🐟", "🦅", "🦊")

HABITAT_MAP = {
    "forest": "forest",
    "mountain": "mountain",
    "desert": "prairie",
    "swamp": "wetland",
    "lake": "river",
}
WILDLIFE_MAP = {
    "bear": "🐻",
    "elk": "🦌",
    "salmon": "🐟",
    "hawk": "🦅",
    "fox": "🦊",
}


@dataclass(frozen=True)
class TileDraft:
    id: str
    kind: str
    printed_animals: Tuple[str, ...]
    terrains: Tuple[str, ...]
    bonus_on_token: bool


@dataclass
class TilePlacement:
    id: str
    kind: str
    printed_animals: Tuple[str, ...]
    terrains: Tuple[str, ...]
    rotation: int
    token: Optional[str] = None
    bonus_on_token: bool = False

    def edge_terrains(self) -> Tuple[str, ...]:
        if self.kind == "single":
            return (self.terrains[0],) * 6
        base = (self.terrains[0], self.terrains[0], self.terrains[0], self.terrains[1], self.terrains[1], self.terrains[1])
        shift = self.rotation % 6
        return tuple(base[(idx - shift) % 6] for idx in range(6))


@dataclass
class MarketPair:
    tile: TileDraft
    token: str


@dataclass(frozen=True)
class MarketChoice:
    tile_index: int
    token_index: int
    is_mixed_pair: bool = False


@dataclass(frozen=True)
class PlacementInput:
    q: int
    r: int
    rotation: int
    token_q: Optional[int]
    token_r: Optional[int]


@dataclass(frozen=True)
class TurnInput:
    manipulations: Tuple[dict, ...]
    choice: MarketChoice
    placement: PlacementInput


@dataclass
class GameState:
    turn: int = 1
    max_turns: int = 20
    nature_tokens: int = 0
    game_over: bool = False
    board: Dict[Tuple[int, int], TilePlacement] = field(default_factory=dict)
    market: List[MarketPair] = field(default_factory=list)


class CascadiaEngine:
    def __init__(self, tile_bag: Sequence[TileDraft], starter_sets: Sequence[Sequence[Tuple[int, int, TileDraft, int]]], seed: int = 0, max_turns: int = 20):
        self.seed = seed
        self.rng = random.Random(seed)
        self._tile_bag_source = list(tile_bag)
        self._starter_sets = [list(s) for s in starter_sets]
        self.state = GameState(max_turns=max_turns)
        self.animal_bag: List[str] = []
        self.tile_bag: List[TileDraft] = []
        self.pending_animal_returns: List[str] = []
        self.log: List[dict] = []

    @classmethod
    def from_legacy_data_js(cls, path: str | Path, seed: int = 0, max_turns: int = 20) -> "CascadiaEngine":
        data = _parse_legacy_data_js(path)
        starter_coords = [(0, 0), (1, 0), (0, 1)]
        starter_sets = []
        for set_idx, starter_set in enumerate(data["startingTiles"]):
            entries = []
            for idx, tile in enumerate(starter_set):
                draft = _convert_legacy_tile(tile, f"starter-{set_idx}")
                q, r = starter_coords[idx]
                entries.append((q, r, draft, int(tile.get("rotation", 0) // 60) % 6))
            starter_sets.append(entries)
        tile_bag = [_convert_legacy_tile(tile, "tile") for tile in data["tiles"]]
        return cls(tile_bag=tile_bag, starter_sets=starter_sets, seed=seed, max_turns=max_turns)

    def reset(self, starter_set_index: int = 0) -> None:
        self.state = GameState(max_turns=self.state.max_turns)
        self.tile_bag = list(self._tile_bag_source)
        self.rng.shuffle(self.tile_bag)
        self.animal_bag = [animal for animal in ANIMALS for _ in range(20)]
        self.rng.shuffle(self.animal_bag)
        self.pending_animal_returns = []
        self.log = []

        for q, r, draft, rotation in self._starter_sets[starter_set_index]:
            self.state.board[(q, r)] = TilePlacement(
                id=draft.id,
                kind=draft.kind,
                printed_animals=draft.printed_animals,
                terrains=draft.terrains,
                rotation=rotation,
                token=None,
                bonus_on_token=draft.bonus_on_token,
            )
        self._refill_market()

    def encode_state(self) -> dict:
        board_entries = []
        for (q, r), tile in sorted(self.state.board.items()):
            board_entries.append({
                "coord": [q, r],
                "id": tile.id,
                "kind": tile.kind,
                "terrains": list(tile.terrains),
                "rotation": tile.rotation,
                "printed_animals": list(tile.printed_animals),
                "token": tile.token,
                "bonus_on_token": tile.bonus_on_token,
            })
        return {
            "seed": self.seed,
            "turn": self.state.turn,
            "max_turns": self.state.max_turns,
            "nature_tokens": self.state.nature_tokens,
            "game_over": self.state.game_over,
            "board": board_entries,
            "market": [
                {"tile_id": p.tile.id, "token": p.token, "terrains": list(p.tile.terrains), "kind": p.tile.kind}
                for p in self.state.market
            ],
            "tile_bag_count": len(self.tile_bag),
            "animal_bag_count": len(self.animal_bag),
        }

    def encode_state_text(self) -> str:
        state = self.encode_state()
        board_text = [
            f"{x['coord'][0]},{x['coord'][1]}:{x['id']}:{'/'.join(x['terrains'])}:r{x['rotation']}:tok={x['token'] or '-'}"
            for x in state["board"]
        ]
        market_text = [f"{idx}:{p['tile_id']}|{p['token']}" for idx, p in enumerate(state["market"])]
        return f"turn={state['turn']};stars={state['nature_tokens']}\nboard={board_text}\nmarket={market_text}"

    def open_coords(self) -> List[Tuple[int, int]]:
        return sorted(self._open_coords())

    def legal_token_coords(self, animal: str) -> List[Tuple[int, int]]:
        return sorted(self._legal_token_spots(animal))

    def apply_turn(self, turn_input: TurnInput) -> None:
        if self.state.game_over:
            raise ValueError("Game is already over.")
        self._apply_market_manipulations(turn_input.manipulations)

        choice = turn_input.choice
        if choice.tile_index < 0 or choice.tile_index >= len(self.state.market):
            raise ValueError("Invalid tile market index")
        if choice.token_index < 0 or choice.token_index >= len(self.state.market):
            raise ValueError("Invalid token market index")
        if not choice.is_mixed_pair and choice.tile_index != choice.token_index:
            raise ValueError("Non-mixed picks must use the same market slot")

        if choice.is_mixed_pair:
            if self.state.nature_tokens <= 0:
                raise ValueError("Mixed pair requires a nature token")
            self.state.nature_tokens -= 1

        placement = turn_input.placement
        if (placement.q, placement.r) in self.state.board:
            raise ValueError("Tile placement must target an open coordinate")
        open_coords = self._open_coords()
        if (placement.q, placement.r) not in open_coords:
            raise ValueError("Tile must be adjacent to existing board")

        tile_draft = self.state.market[choice.tile_index].tile
        chosen_token = self.state.market[choice.token_index].token
        placed_tile = TilePlacement(
            id=tile_draft.id,
            kind=tile_draft.kind,
            printed_animals=tile_draft.printed_animals,
            terrains=tile_draft.terrains,
            rotation=placement.rotation % 6,
            token=None,
            bonus_on_token=tile_draft.bonus_on_token,
        )
        self.state.board[(placement.q, placement.r)] = placed_tile

        legal_token_spots = self._legal_token_spots(chosen_token)
        if legal_token_spots:
            if placement.token_q is None or placement.token_r is None:
                raise ValueError("Token placement is required when legal spots exist")
            token_coord = (placement.token_q, placement.token_r)
            if token_coord not in legal_token_spots:
                raise ValueError("Illegal token placement")
            token_tile = self.state.board[token_coord]
            token_tile.token = chosen_token
            if token_tile.bonus_on_token:
                token_tile.bonus_on_token = False
                self.state.nature_tokens += 1
        else:
            if placement.token_q is not None or placement.token_r is not None:
                raise ValueError("No token may be placed when none are legal")

        self._remove_market_choice(choice)
        self._return_pending_animals()
        self._refill_market()
        self._force_quad_refreshes()

        log_entry = {
            "turn": self.state.turn,
            "input": {
                "manipulations": list(turn_input.manipulations),
                "choice": choice.__dict__,
                "placement": placement.__dict__,
            },
            "state": self.encode_state(),
        }
        self.log.append(log_entry)

        if self.state.turn >= self.state.max_turns:
            self.state.game_over = True
        else:
            self.state.turn += 1

    def score(self) -> dict:
        terrain_scores = {t: self._largest_terrain_region(t) for t in TERRAINS}
        animal_scores = {
            "🐻": self._score_bears(),
            "🦌": self._score_elk(),
            "🐟": self._score_salmon(),
            "🦅": self._score_hawks(),
            "🦊": self._score_foxes(),
        }
        terrain_total = sum(terrain_scores.values())
        animal_total = sum(animal_scores.values())
        return {
            "terrain_scores": terrain_scores,
            "animal_scores": animal_scores,
            "terrain_total": terrain_total,
            "animal_total": animal_total,
            "nature_token_points": self.state.nature_tokens,
            "total": terrain_total + animal_total + self.state.nature_tokens,
        }

    def export_log(self) -> str:
        return json.dumps({"seed": self.seed, "entries": self.log}, indent=2)

    def replay_log(self, log_text: str) -> None:
        payload = json.loads(log_text)
        self.__init__(tile_bag=self._tile_bag_source, starter_sets=self._starter_sets, seed=payload["seed"], max_turns=self.state.max_turns)
        self.reset()
        for entry in payload["entries"]:
            choice = MarketChoice(**entry["input"]["choice"])
            placement = PlacementInput(**entry["input"]["placement"])
            turn_input = TurnInput(
                manipulations=tuple(entry["input"]["manipulations"]),
                choice=choice,
                placement=placement,
            )
            self.apply_turn(turn_input)

    def _apply_market_manipulations(self, manipulations: Iterable[dict]) -> None:
        for m in manipulations:
            kind = m.get("kind")
            if kind == "refresh_tokens":
                if self.state.nature_tokens <= 0:
                    raise ValueError("refresh_tokens requires a nature token")
                self.state.nature_tokens -= 1
                for idx in m.get("indices", []):
                    self._reroll_token_at(int(idx))
            elif kind == "reroll_triple":
                if self.state.nature_tokens <= 0:
                    raise ValueError("reroll_triple requires a nature token")
                animal = m.get("animal")
                idxs = [i for i, p in enumerate(self.state.market) if p.token == animal]
                if len(idxs) != 3:
                    raise ValueError("reroll_triple requires exactly three matching market tokens")
                self.state.nature_tokens -= 1
                for idx in idxs:
                    self._reroll_token_at(idx)
            else:
                raise ValueError(f"Unknown manipulation kind: {kind}")

    def _reroll_token_at(self, idx: int) -> None:
        old = self.state.market[idx].token
        self.pending_animal_returns.append(old)
        self.state.market[idx].token = self.animal_bag.pop()

    def _remove_market_choice(self, choice: MarketChoice) -> None:
        indexes = sorted({choice.tile_index, choice.token_index}, reverse=True)
        for idx in indexes:
            removed = self.state.market.pop(idx)
            if idx != choice.token_index:
                self.pending_animal_returns.append(removed.token)
        if self.state.market:
            leftmost = self.state.market.pop(0)
            self.pending_animal_returns.append(leftmost.token)

    def _return_pending_animals(self) -> None:
        if self.pending_animal_returns:
            self.animal_bag.extend(self.pending_animal_returns)
            self.pending_animal_returns.clear()
            self.rng.shuffle(self.animal_bag)

    def _refill_market(self) -> None:
        while len(self.state.market) < 4 and self.tile_bag and self.animal_bag:
            self.state.market.append(MarketPair(tile=self.tile_bag.pop(), token=self.animal_bag.pop()))

    def _force_quad_refreshes(self) -> None:
        while len(self.state.market) == 4 and len({p.token for p in self.state.market}) == 1:
            for idx in range(4):
                self._reroll_token_at(idx)
            self._return_pending_animals()

    def _open_coords(self) -> set[Tuple[int, int]]:
        out: set[Tuple[int, int]] = set()
        for q, r in self.state.board.keys():
            for dq, dr in AXIAL_DIRECTIONS:
                c = (q + dq, r + dr)
                if c not in self.state.board:
                    out.add(c)
        return out

    def _legal_token_spots(self, animal: str) -> set[Tuple[int, int]]:
        out = set()
        for coord, tile in self.state.board.items():
            if tile.token is None and animal in tile.printed_animals:
                out.add(coord)
        return out

    def _largest_terrain_region(self, terrain: str) -> int:
        visited = set()
        best = 0
        for coord, tile in self.state.board.items():
            if coord in visited:
                continue
            if terrain not in tile.terrains:
                continue
            size = 0
            stack = [coord]
            while stack:
                cur = stack.pop()
                if cur in visited:
                    continue
                visited.add(cur)
                cur_tile = self.state.board[cur]
                if terrain not in cur_tile.terrains:
                    continue
                size += 1
                cur_edges = cur_tile.edge_terrains()
                for edge_idx, (dq, dr) in enumerate(AXIAL_DIRECTIONS):
                    nxt = (cur[0] + dq, cur[1] + dr)
                    if nxt not in self.state.board:
                        continue
                    nxt_tile = self.state.board[nxt]
                    nxt_edges = nxt_tile.edge_terrains()
                    if cur_edges[edge_idx] == terrain and nxt_edges[(edge_idx + 3) % 6] == terrain:
                        stack.append(nxt)
            best = max(best, size)
        return best

    def _animal_graph(self, animal: str) -> Dict[Tuple[int, int], List[Tuple[int, int]]]:
        nodes = [coord for coord, tile in self.state.board.items() if tile.token == animal]
        node_set = set(nodes)
        graph: Dict[Tuple[int, int], List[Tuple[int, int]]] = {coord: [] for coord in nodes}
        for q, r in nodes:
            for dq, dr in AXIAL_DIRECTIONS:
                n = (q + dq, r + dr)
                if n in node_set:
                    graph[(q, r)].append(n)
        return graph

    def _components(self, graph: Dict[Tuple[int, int], List[Tuple[int, int]]]) -> List[set[Tuple[int, int]]]:
        seen = set()
        comps = []
        for node in graph:
            if node in seen:
                continue
            comp = set()
            stack = [node]
            while stack:
                cur = stack.pop()
                if cur in comp:
                    continue
                comp.add(cur)
                for nxt in graph[cur]:
                    if nxt not in comp:
                        stack.append(nxt)
            seen.update(comp)
            comps.append(comp)
        return comps

    def _score_bears(self) -> int:
        pairs = sum(1 for comp in self._components(self._animal_graph("🐻")) if len(comp) == 2)
        table = {1: 4, 2: 11, 3: 19}
        return table.get(pairs, 27 if pairs >= 4 else 0)

    def _score_elk(self) -> int:
        graph = self._animal_graph("🦌")
        used = set()
        lines = []
        directions = AXIAL_DIRECTIONS[:3]
        for node in graph:
            if node in used:
                continue
            best_line = [node]
            for dq, dr in directions:
                line = [node]
                for sign in (1, -1):
                    cur = node
                    while True:
                        nxt = (cur[0] + dq * sign, cur[1] + dr * sign)
                        if nxt in graph and nxt not in line:
                            line.append(nxt)
                            cur = nxt
                        else:
                            break
                if len(line) > len(best_line):
                    best_line = line
            for c in best_line:
                used.add(c)
            lines.append(len(best_line))
        table = {1: 2, 2: 5, 3: 9}
        return sum(table.get(n, 13) for n in lines)

    def _score_foxes(self) -> int:
        score = 0
        for (q, r), tile in self.state.board.items():
            if tile.token != "🦊":
                continue
            adjacent_species = set()
            for dq, dr in AXIAL_DIRECTIONS:
                other = self.state.board.get((q + dq, r + dr))
                if other and other.token:
                    adjacent_species.add(other.token)
            score += len(adjacent_species)
        return score

    def _score_hawks(self) -> int:
        graph = self._animal_graph("🦅")
        isolated = sum(1 for node, neighbors in graph.items() if len(neighbors) == 0)
        table = {1: 2, 2: 5, 3: 8, 4: 11, 5: 14, 6: 18, 7: 22}
        return table.get(isolated, 26 if isolated >= 8 else 0)

    def _score_salmon(self) -> int:
        graph = self._animal_graph("🐟")
        total = 0
        for comp in self._components(graph):
            valid = True
            for node in comp:
                salmon_neighbors = sum(1 for nxt in graph[node] if nxt in comp)
                if salmon_neighbors < 1 or salmon_neighbors > 2:
                    valid = False
                    break
            if not valid:
                continue
            n = len(comp)
            if n == 1:
                total += 2
            elif n == 2:
                total += 5
            elif n == 3:
                total += 8
            elif n == 4:
                total += 12
            elif n == 5:
                total += 16
            elif n == 6:
                total += 20
            else:
                total += 25
        return total


def _convert_legacy_tile(legacy_tile: dict, id_prefix: str) -> TileDraft:
    habitats = tuple(HABITAT_MAP[h] for h in legacy_tile["habitats"])
    animals = tuple(WILDLIFE_MAP[a] for a in legacy_tile["wildlife"])
    tile_num = legacy_tile.get("tileNum", "x")
    if len(habitats) <= 1:
        return TileDraft(id=f"{id_prefix}-{tile_num}", kind="single", printed_animals=animals, terrains=(habitats[0],), bonus_on_token=True)
    return TileDraft(id=f"{id_prefix}-{tile_num}", kind="split", printed_animals=animals, terrains=(habitats[0], habitats[1]), bonus_on_token=False)


def _parse_legacy_data_js(path: str | Path) -> dict:
    content = Path(path).read_text(encoding="utf-8")
    stripped = re.sub(r"//.*", "", content)

    def extract(var_name: str) -> str:
        anchor = re.search(rf"var\s+{var_name}\s*=", stripped)
        if not anchor:
            raise ValueError(f"Could not find {var_name} in {path}")
        idx = anchor.end()
        while idx < len(stripped) and stripped[idx].isspace():
            idx += 1
        if idx >= len(stripped) or stripped[idx] != "[":
            raise ValueError(f"{var_name} does not start with [ in {path}")
        depth = 0
        end = idx
        for pos in range(idx, len(stripped)):
            ch = stripped[pos]
            if ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    end = pos
                    break
        raw = stripped[idx : end + 1]
        raw = re.sub(r"(\b[a-zA-Z_][a-zA-Z0-9_]*)\s*:", r'"\1":', raw)
        raw = raw.replace("'", '"')
        raw = re.sub(r",(\s*[\]}])", r"\1", raw)
        return raw

    return {
        "startingTiles": json.loads(extract("startingTiles")),
        "tiles": json.loads(extract("tiles")),
    }
