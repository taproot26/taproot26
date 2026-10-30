#!/usr/bin/env python3
"""Regenerate pixel art and install the game-ready files.

    python3 tools/pixelgen/build.py            # every generator
    python3 tools/pixelgen/build.py items loot # just these

Generators write to tools/pixelgen/out/<set>; INSTALL copies what the game
loads into game/. Sets with no entry (market, interior, coast, cave) are previews and
source art only until a map uses them.
"""
import importlib
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAME = HERE.parent.parent / "game"
sys.path.insert(0, str(HERE))

GENERATORS = ["market", "interior", "interior_mart", "monsters", "loot", "coast", "items", "city3d", "valley", "cave"]
INSTALL = {
    "monsters": ("monsters", GAME / "world/assets/monsters", ["monsters.png", "king_slime.png", "slash.png"]),
    "loot": ("loot", GAME / "world/assets/loot", ["loot.png", "coin.png", "gold.png", "slime_gel.png", "spore_cap.png",
                                                  "bat_fang.png", "goblin_ear.png", "royal_jelly.png"]),
    "items": ("items", GAME / "assets/items", None),  # None = every PNG in the set
    "city3d": ("city3d", GAME / "city3d/assets", None),
    "valley": ("valley", GAME / "world/assets/valley", None),
    "coast": ("coast", GAME / "world/assets/coast", [f"{k}.png" for k in (
        "dock", "dock_edge_s", "dock_side_w", "dock_side_e", "quay_top", "quay_face", "tavern", "lighthouse", "pirate_ship", "sloop",
        "rowboat", "palm", "barrel", "crate", "sack", "cannon", "rope_coil", "anchor", "chest", "bollard", "buoy", "crab", "seagull")]),
}


def install(name):
    if name not in INSTALL:
        return 0
    sub, dest, files = INSTALL[name]
    src = HERE / "out" / sub
    dest.mkdir(parents=True, exist_ok=True)
    picks = files or [p.name for p in src.glob("*.png") if not p.name.endswith("_preview.png")]
    for f in picks:
        shutil.copy2(src / f, dest / f)
    return len(picks)


def main(args):
    names = args or GENERATORS
    unknown = [n for n in names if n not in GENERATORS]
    if unknown:
        sys.exit(f"unknown set(s): {', '.join(unknown)}. Choose from: {', '.join(GENERATORS)}")
    for name in names:
        importlib.import_module(name).main()
        n = install(name)
        if n:
            print(f"  installed {n} file(s) -> {INSTALL[name][1].relative_to(GAME.parent)}")


if __name__ == "__main__":
    main(sys.argv[1:])
