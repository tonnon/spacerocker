"""Animation states.

Frame counts and semantics are fixed by the spec:

    idle 4 (loop) · bank_left 3 · bank_right 3 · charge 6 · fire 2 · hit 1
    death 8        · damaged 2 (boss parts) · destroyed 6 (boss parts)

Every state is produced by re-drawing the ship with different Ctx parameters,
so nothing is ever a post-hoc filter over a single base image.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from .render import SS, Ctx, explosion, finish, glow_disc

FRAME_COUNTS = {
    "idle": 4, "bank_left": 3, "bank_right": 3, "charge": 6, "fire": 2,
    "hit": 1, "death": 8, "damaged": 2, "destroyed": 6,
}

FPS = {"idle": 8, "bank_left": 14, "bank_right": 14, "charge": 10, "fire": 16,
       "hit": 1, "death": 12, "damaged": 6, "destroyed": 12}

LOOPS = {"idle", "damaged"}


def params(state: str, i: int, n: int, spins: bool) -> dict:
    """Ctx parameters for frame i of a state."""
    t = i / max(1, n - 1) if n > 1 else 0.0
    p = dict(bank=0.0, bob=0.0, glow=1.0, muzzle=0.0, charge=0.0, spin=0.0)

    if state == "idle":
        ph = math.tau * i / n
        p["bob"] = math.sin(ph) * 0.9
        p["glow"] = 1.0 + 0.16 * math.sin(ph)
        p["spin"] = ph if spins else 0.0
    elif state in ("bank_left", "bank_right"):
        s = -1.0 if state == "bank_left" else 1.0
        amt = (i + 1) / n
        if spins:
            p["spin"] = s * 0.46 * amt
        else:
            p["bank"] = s * amt
            p["bob"] = -0.4 * amt
    elif state == "charge":
        p["charge"] = t
        p["glow"] = 0.55 + 1.25 * (t ** 0.8)
        p["bob"] = -0.8 * math.sin(math.pi * t)
        p["spin"] = math.tau * t if spins else 0.0
    elif state == "fire":
        p["muzzle"] = 1.0 if i == 0 else 0.5
        p["glow"] = 1.35 if i == 0 else 1.1
        p["bob"] = 1.6 if i == 0 else 0.7   # recoil
        p["charge"] = 1.0
    elif state == "damaged":
        p["glow"] = 0.42 + 0.16 * i
        p["bob"] = 0.6 * i
    elif state == "hit":
        p["glow"] = 1.0
    return p


# ------------------------------------------------------------------ overlays


def _mask_layer(ctx: Ctx, layer: Image.Image) -> None:
    """Composite ``layer`` onto the albedo, clipped to the current silhouette."""
    alpha = ctx._albedo.split()[-1]
    layer.putalpha(Image.fromarray(
        np.minimum(np.asarray(layer.split()[-1], np.int16),
                   np.asarray(alpha, np.int16)).astype(np.uint8)))
    ctx._albedo.alpha_composite(layer)


def battle_damage(ctx: Ctx, severity: float, seed: int) -> None:
    """Cracks, scorch and blown-out holes, clipped to the silhouette."""
    rng = np.random.default_rng(seed)
    w, h = ctx._albedo.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")

    for _ in range(int(4 + 6 * severity)):
        x, y = rng.uniform(0.15, 0.85) * w, rng.uniform(0.15, 0.85) * h
        pts = [(x, y)]
        ang = rng.uniform(0, math.tau)
        for _ in range(rng.integers(3, 6)):
            ang += rng.uniform(-0.9, 0.9)
            ln = rng.uniform(0.04, 0.12) * w
            x += math.cos(ang) * ln
            y += math.sin(ang) * ln
            pts.append((x, y))
        d.line(pts, fill=(6, 7, 13, 255), width=max(1, int(SS * 1.5)))

    for _ in range(int(2 + 4 * severity)):
        cx, cy = rng.uniform(0.18, 0.82) * w, rng.uniform(0.18, 0.82) * h
        r = rng.uniform(0.022, 0.055) * w * (0.7 + severity)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(10, 12, 20, 255))
        d.ellipse([cx - r * 0.62, cy - r * 0.62, cx + r * 0.62, cy + r * 0.62],
                  fill=(52, 30, 24, 255))

    for _ in range(int(3 + 3 * severity)):
        cx, cy = rng.uniform(0.1, 0.9) * w, rng.uniform(0.1, 0.9) * h
        r = rng.uniform(0.06, 0.16) * w
        d.ellipse([cx - r, cy - r, cx + r, cy + r],
                  fill=(20, 18, 22, int(120 * severity)))

    _mask_layer(ctx, layer)


def hit_flash(ctx: Ctx) -> None:
    """Blow the whole ship out to near-white, keeping the silhouette."""
    arr = np.asarray(ctx._albedo, dtype=np.int16).copy()
    solid = arr[..., 3] > 40
    arr[..., 0][solid] = 244
    arr[..., 1][solid] = 248
    arr[..., 2][solid] = 255
    ctx._albedo = Image.fromarray(arr.astype(np.uint8), "RGBA")
    ctx.da = ImageDraw.Draw(ctx._albedo, "RGBA")
    e = np.asarray(ctx._emissive, dtype=np.int16).copy()
    e[solid] = np.clip(e[solid] + 130, 0, 255)
    ctx._emissive = Image.fromarray(e.astype(np.uint8), "RGB")
    ctx.de = ImageDraw.Draw(ctx._emissive, "RGB")


def _fade(ctx: Ctx, k: float) -> None:
    a = np.asarray(ctx._albedo.split()[-1], np.int16)
    ctx._albedo.putalpha(Image.fromarray(
        np.clip(a * k, 0, 255).astype(np.uint8)))


# -------------------------------------------------------------------- render


def render_frame(draw_fn, w: int, h: int, act: int, seed: int, state: str,
                 i: int, spins: bool, gun=None, spread=0.95):
    n = FRAME_COUNTS[state]
    p = params(state, i, n, spins)
    ctx = Ctx(size=w, height=h, act=act, seed=seed, **p)

    if state in ("death", "destroyed"):
        t = i / (n - 1)
        if t < 0.46:
            draw_fn(ctx)
            if i == 0:
                hit_flash(ctx)
            else:
                battle_damage(ctx, 0.8 + 0.5 * t, seed * 17 + i)
                _fade(ctx, 1.0 - (t / 0.46) ** 1.5)
        explosion(ctx, t, spread=spread, chunks=9 if state == "death" else 14)
        return finish(ctx)

    draw_fn(ctx)

    if state == "damaged":
        battle_damage(ctx, 0.55 + 0.35 * i, seed * 31 + i)
    if state == "hit":
        hit_flash(ctx)
    if state == "charge" and gun is not None:
        glow_disc(ctx, gun[0], gun[1], 0.05 + 0.13 * p["charge"], "core",
                  0.7 + 1.3 * p["charge"])
        glow_disc(ctx, gun[0], gun[1], 0.02 + 0.06 * p["charge"], "warn", 1.9)

    return finish(ctx)
