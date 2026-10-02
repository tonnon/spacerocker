"""Shelf packer + atlas export.

Albedo and emissive share one layout, so a single JSON describes both.
Every frame gets 2px of padding and 1px of edge extrusion so the GPU never
samples a neighbouring frame at non-integer scales.
"""
from __future__ import annotations

import json

import numpy as np
from PIL import Image

PAD = 2
EXTRUDE = 1

CANDIDATES = [(1024, 1024), (2048, 1024), (2048, 2048), (2048, 4096),
              (4096, 4096)]


def _extrude(img: Image.Image) -> Image.Image:
    a = np.asarray(img)
    mode = "RGBA" if a.shape[2] == 4 else "RGB"
    p = np.pad(a, ((EXTRUDE, EXTRUDE), (EXTRUDE, EXTRUDE), (0, 0)), mode="edge")
    return Image.fromarray(p, mode)


def pack(sizes: dict[str, tuple[int, int]]):
    """Shelf-pack by descending height. Returns (w, h, {key: (x, y)})."""
    order = sorted(sizes, key=lambda k: (-sizes[k][1], -sizes[k][0], k))
    for W, H in CANDIDATES:
        place, x, y, shelf_h = {}, PAD, PAD, 0
        ok = True
        for k in order:
            w, h = sizes[k]
            if x + w + PAD > W:
                x, y, shelf_h = PAD, y + shelf_h + PAD, 0
            if y + h + PAD > H:
                ok = False
                break
            place[k] = (x, y)
            x += w + PAD
            shelf_h = max(shelf_h, h)
        if ok:
            return W, H, place
    raise RuntimeError("atlas overflow: no candidate size fits")


def build(frames: dict, meta: dict, out_dir, name: str):
    """frames: key -> dict(albedo, emissive, pivot, extra).

    Writes ``<name>_albedo.png``, ``<name>_emissive.png`` and ``<name>.json``.
    """
    sizes = {k: v["albedo"].size for k, v in frames.items()}
    W, H, place = pack(sizes)

    alb = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    emi = Image.new("RGB", (W, H), (0, 0, 0))

    entries = {}
    for k, f in frames.items():
        x, y = place[k]
        w, h = f["albedo"].size
        alb.paste(_extrude(f["albedo"]), (x - EXTRUDE, y - EXTRUDE))
        emi.paste(_extrude(f["emissive"].convert("RGB")),
                  (x - EXTRUDE, y - EXTRUDE))
        px, py = f.get("pivot", (0.5, 0.5))
        entries[k] = {
            "frame": {"x": x, "y": y, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
            "pivot": {"x": px, "y": py},
            **f.get("extra", {}),
        }

    doc = {
        "meta": {
            "app": "spacerocker-spritegen",
            "version": "1.0",
            "image": f"{name}_albedo.png",
            "emissive": f"{name}_emissive.png",
            "size": {"w": W, "h": H},
            "scale": "1",
            "padding": PAD,
            "extrude": EXTRUDE,
            **meta,
        },
        "frames": dict(sorted(entries.items())),
    }

    alb.save(out_dir / f"{name}_albedo.png", optimize=True)
    emi.save(out_dir / f"{name}_emissive.png", optimize=True)
    (out_dir / f"{name}.json").write_text(json.dumps(doc, indent=1),
                                          encoding="utf-8", newline="\n")
    return W, H, len(frames)
