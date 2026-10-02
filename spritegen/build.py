"""Entry point: `python -m spritegen.build [--act 1] [--only scrap]`.

Deterministic: same source, same bytes out.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import atlas, basilisk, contact, favicon, hexapod, ouroboros
from .anim import FPS, FRAME_COUNTS, LOOPS, render_frame
from .enemies import ships_for_act
from .player import PICKUPS, player as player_draw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "sprites"
# the browser wants these at the web root, not with the atlases
ICON_OUT = ROOT / "public"

ENEMY_STATES = ["idle", "bank_left", "bank_right", "charge", "fire", "hit",
                "death"]

ENEMY_META = {
    "scrap":       dict(gun=(0.03, 0.72), hit_radius=0.34, spins=False),
    "interceptor": dict(gun=(0.00, 0.90), hit_radius=0.26, spins=False),
    "turret":      dict(gun=(0.00, 0.50), hit_radius=0.34, spins=True),
    "swarmer":     dict(gun=(0.00, 0.80), hit_radius=0.26, spins=False),
    # act II
    "bulwark":     dict(gun=(0.00, 0.30), hit_radius=0.36, spins=False),
    "miner":       dict(gun=(0.00, -0.60), hit_radius=0.32, spins=False),
    "lance":       dict(gun=(0.00, 1.00), hit_radius=0.16, spins=False),
    "wraith":      dict(gun=(0.00, 0.26), hit_radius=0.28, spins=False),
    # act III
    "splitter":    dict(gun=(0.00, 0.66), hit_radius=0.34, spins=False),
    "runner":      dict(gun=(0.00, 0.74), hit_radius=0.30, spins=False),
    "barge":       dict(gun=(0.00, 0.58), hit_radius=0.40, spins=False),
}

BOSS_GUNS = {"pod_l": (0.03, 0.88), "pod_r": (-0.03, 0.88), "core": (0.0, 0.0),
             "bay": None, "hull": None}


def _anim_block(entity: str, states) -> dict:
    return {s: {"frames": [f"{entity}_{s}_{i}" for i in range(FRAME_COUNTS[s])],
                "fps": FPS[s], "loop": s in LOOPS}
            for s in states}


def build_act(act: int) -> dict:
    frames, entities = {}, {}
    for name, spec in ships_for_act(act).items():
        m = ENEMY_META[name]
        for state in ENEMY_STATES:
            for i in range(FRAME_COUNTS[state]):
                alb, emi = render_frame(
                    spec["fn"], spec["size"], spec["size"], act, spec["seed"],
                    state, i, m["spins"], gun=m["gun"])
                frames[f"{name}_{state}_{i}"] = dict(
                    albedo=alb, emissive=emi, pivot=(0.5, 0.5),
                    extra={"entity": name, "state": state})
        entities[name] = {
            "frameSize": {"w": spec["size"], "h": spec["size"]},
            "hitRadius": m["hit_radius"],
            "gun": list(m["gun"]),
            "animations": _anim_block(name, ENEMY_STATES),
        }
    W, H, n = atlas.build(
        frames, {"act": act, "entities": entities}, OUT, f"act{act}")
    return {"name": f"act{act}", "w": W, "h": H, "frames": n}


def build_hexapod(act: int = 1) -> dict:
    return build_boss(hexapod, "boss_hexapod", act)


def build_boss(mod, atlas_name: str, act: int = 1) -> dict:
    """Render one boss, part by part, into its own dedicated atlas.

    A boss is never a single sprite: the hull, every cannon, every arm and the
    core are separate frame sets, so the engine can destroy one and leave the
    rest animating (spec 8).
    """
    frames, parts = {}, {}
    guns = getattr(mod, "GUNS", {})
    for name, spec in mod.PARTS.items():
        spins = name == "core"
        for state in spec["states"]:
            for i in range(FRAME_COUNTS[state]):
                alb, emi = render_frame(
                    spec["fn"], spec["w"], spec["h"], act, spec["seed"],
                    state, i, spins, gun=guns.get(name),
                    spread=1.15 if name == "hull" else 0.9)
                frames[f"{name}_{state}_{i}"] = dict(
                    albedo=alb, emissive=emi, pivot=(0.5, 0.5),
                    extra={"entity": name, "state": state, "partId": name})
        parts[name] = {
            "frameSize": {"w": spec["w"], "h": spec["h"]},
            "hp": spec["hp"],
            "anchor": list(spec["anchor"]),
            "animations": _anim_block(name, spec["states"]),
        }
    meta = {"act": act, "boss": {**mod.META, "parts": parts}}
    W, H, n = atlas.build(frames, meta, OUT, atlas_name)
    return {"name": atlas_name, "w": W, "h": H, "frames": n}


# Each act ends on its own boss (spec 6).
BOSS_OF_ACT = {
    1: (hexapod, "boss_hexapod"),
    2: (basilisk, "boss_basilisk"),
    3: (ouroboros, "boss_ouroboros"),
}

PLAYER_GUN = (0.0, -0.90)


def build_common() -> dict:
    """Act-independent atlas: the player ship and the seven pickups."""
    frames, entities = {}, {}
    for state in ENEMY_STATES:
        for i in range(FRAME_COUNTS[state]):
            alb, emi = render_frame(player_draw, 128, 128, 0, 99, state, i,
                                    False, gun=PLAYER_GUN)
            frames[f"player_{state}_{i}"] = dict(
                albedo=alb, emissive=emi, pivot=(0.5, 0.5),
                extra={"entity": "player", "state": state})
    entities["player"] = {
        "frameSize": {"w": 128, "h": 128},
        "hitRadius": 0.12,
        "gun": list(PLAYER_GUN),
        "animations": _anim_block("player", ENEMY_STATES),
    }
    for name, spec in PICKUPS.items():
        for i in range(FRAME_COUNTS["idle"]):
            alb, emi = render_frame(spec["fn"], spec["size"], spec["size"],
                                    0, spec["seed"], "idle", i, False)
            frames[f"{name}_idle_{i}"] = dict(
                albedo=alb, emissive=emi, pivot=(0.5, 0.5),
                extra={"entity": name, "state": "idle"})
        entities[name] = {
            "frameSize": {"w": spec["size"], "h": spec["size"]},
            "hitRadius": 0.40,
            "animations": _anim_block(name, ["idle"]),
        }
    W, H, n = atlas.build(frames, {"act": 0, "entities": entities}, OUT,
                          "common")
    return {"name": "common", "w": W, "h": H, "frames": n}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--act", type=int, default=1)
    ap.add_argument("--skip-boss", action="store_true")
    ap.add_argument("--skip-common", action="store_true")
    ap.add_argument("--only-common", action="store_true")
    ap.add_argument("--only-icons", action="store_true")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    if args.only_icons:
        print("  icons -> " + ", ".join(favicon.write(ICON_OUT)))
        return
    report = []
    if not args.skip_common:
        report.append(build_common())
    if not args.only_common:
        report.append(build_act(args.act))
        if not args.skip_boss:
            boss = BOSS_OF_ACT.get(args.act)
            if boss:
                mod, name = boss
                report.append(build_boss(mod, name, args.act))

    for r in report:
        print("  {:<16} {}x{}  {} frames".format(r["name"], r["w"], r["h"], r["frames"]))
    names = sorted({p.stem[:-7] for p in OUT.glob("*_albedo.png")})
    (OUT / "index.json").write_text(
        json.dumps({"atlases": names}, indent=1),
        encoding="utf-8", newline="\n")
    # The sheet lives beside the PNGs, so it links them instead of
    # embedding ~19MB of base64 into the repo.
    print(f"  contact sheet -> {contact.write(OUT, inline=False).name}")
    print("  icons -> " + ", ".join(favicon.write(ICON_OUT)))


if __name__ == "__main__":
    main()
