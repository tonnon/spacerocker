"""The player ship and the pickup capsules.

Unlike the bestiary these are act-independent: the player is ALWAYS magenta +
cyan so the eye can find it in any palette (spec 3). They render with act=0,
a palette slot added to ``render.ACT_EMISSIVE``.

Convention flip: enemies face DOWN (nose at +y). The player faces UP the
screen, so its nose is at -y and the exhaust blows towards +y. That keeps the
global top-light bevel correct instead of rotating the billboard in the engine.
"""
from __future__ import annotations

import math

from .render import (Ctx, disc, glow_disc, glow_line, glow_poly, line, plate,
                     rivets)


def mir(pts):
    return list(pts) + [(-x, y) for x, y in reversed(pts)]


def shrink(pts, k, cy=0.0):
    return [(x * k, cy + (y - cy) * k) for x, y in pts]


def nozzle_up(ctx: Ctx, cx, cy, w, h, intensity=1.0):
    """Engine bell whose exhaust blows towards +y (behind the player)."""
    plate(ctx, [(cx - w, cy), (cx + w, cy), (cx + w * 0.72, cy - h * 0.55),
                (cx - w * 0.72, cy - h * 0.55)], "hull", 0)
    glow_poly(ctx, [(cx - w * 0.78, cy - h * 0.10), (cx + w * 0.78, cy - h * 0.10),
                    (cx + w * 0.34, cy + h * 0.95 * intensity),
                    (cx - w * 0.34, cy + h * 0.95 * intensity)],
              "main", 0.95 * intensity)
    glow_poly(ctx, [(cx - w * 0.38, cy - h * 0.06), (cx + w * 0.38, cy - h * 0.06),
                    (cx + w * 0.16, cy + h * 1.25 * intensity),
                    (cx - w * 0.16, cy + h * 1.25 * intensity)],
              "core", 1.35 * intensity)


def muzzle_up(ctx: Ctx, cx, cy, w=0.14, h=0.30):
    """Muzzle flash pointing -y."""
    m = ctx.muzzle
    if m <= 0.01:
        return
    glow_poly(ctx, [(cx - w * m, cy), (cx + w * m, cy),
                    (cx + w * 0.28 * m, cy - h * m * 1.6),
                    (cx - w * 0.28 * m, cy - h * m * 1.6)], "main", 1.9 * m)
    glow_disc(ctx, cx, cy - h * 0.2 * m, w * 0.5 * m, "core", 2.0 * m)


# ------------------------------------------------------------------ player
# Forward-swept interceptor. Reads as an arrowhead with two outboard nacelles
# and a magenta spine; nothing else in the game has that silhouette.


def player(ctx: Ctx):
    # outboard nacelles
    for s in (1, -1):
        plate(ctx, [(s * 0.30, -0.30), (s * 0.52, -0.16), (s * 0.55, 0.42),
                    (s * 0.33, 0.50)], "hull", 1)
        plate(ctx, [(s * 0.34, -0.22), (s * 0.48, -0.12), (s * 0.50, 0.36),
                    (s * 0.36, 0.42)], "hull", 2)
        plate(ctx, [(s * 0.36, -0.30), (s * 0.47, -0.22), (s * 0.46, -0.02),
                    (s * 0.35, -0.06)], "hull", 0)

    # main wing
    wing = [(0.00, -0.52), (0.26, -0.34), (0.62, 0.22), (0.70, 0.52),
            (0.30, 0.44), (0.12, 0.62), (0.00, 0.66)]
    plate(ctx, mir(wing), "hull", 1)
    plate(ctx, shrink(mir(wing), 0.80, 0.08), "hull", 2)

    # fuselage spine
    body = mir([(0.00, -0.92), (0.10, -0.52), (0.15, 0.06), (0.13, 0.46),
                (0.00, 0.58)])
    plate(ctx, body, "hull", 1)
    plate(ctx, shrink(body, 0.72, -0.04), "hull", 3)

    # canopy
    plate(ctx, mir([(0.00, -0.56), (0.075, -0.28), (0.065, 0.06),
                    (0.00, 0.14)]), "glass", 1)
    plate(ctx, [(-0.032, -0.44), (0.012, -0.46), (0.018, -0.18),
                (-0.028, -0.16)], "glass", 3)

    line(ctx, [(-0.16, 0.20), (0.16, 0.20)], "hull", 0, 0.9)
    rivets(ctx, [(-0.13, 0.36), (0.13, 0.36), (-0.40, 0.10), (0.40, 0.10)], 0.016)

    # neon: cyan drive, magenta identity stripe
    for s in (1, -1):
        nozzle_up(ctx, s * 0.42, 0.48, 0.12, 0.42)
        glow_line(ctx, [(s * 0.14, -0.30), (s * 0.55, 0.16)], "warn", 0.95, 1.5)
        glow_disc(ctx, s * 0.44, -0.24, 0.036, "main", 1.1)
    nozzle_up(ctx, 0.0, 0.56, 0.15, 0.48)
    glow_poly(ctx, [(-0.05, -0.86), (0.05, -0.86), (0.075, -0.40),
                    (-0.075, -0.40)], "warn", 1.25)
    glow_disc(ctx, 0.0, -0.20, 0.055, "core", 1.15)
    muzzle_up(ctx, 0.0, -0.90)


# ----------------------------------------------------------------- pickups
# One housing, seven glyphs. The glyph is emissive so it pulses white-hot
# through the bloom; the housing stays dark so it never competes with a bullet.


def _housing(ctx: Ctx):
    caps = [(math.cos(a) * 0.70, math.sin(a) * 0.70)
            for a in [math.tau * i / 8 + math.pi / 8 for i in range(8)]]
    plate(ctx, caps, "hull", 0)
    plate(ctx, shrink(caps, 0.86), "hull", 1)
    plate(ctx, shrink(caps, 0.70), "dark", 0)
    for i in range(8):
        a = math.tau * i / 8 + math.pi / 8
        glow_disc(ctx, math.cos(a) * 0.62, math.sin(a) * 0.62, 0.030, "main",
                  0.55 + 0.35 * ctx.glow)


def _glyph_spread(ctx: Ctx):
    for k, dx in ((0, 0.0), (1, 0.26), (-1, -0.26)):
        glow_poly(ctx, [(dx - 0.055, 0.30), (dx + 0.055, 0.30),
                        (dx + k * 0.16 + 0.035, -0.34),
                        (dx + k * 0.16 - 0.035, -0.34)], "core", 1.5)


def _glyph_lance(ctx: Ctx):
    glow_poly(ctx, [(-0.10, 0.36), (0.10, 0.36), (0.045, -0.40),
                    (-0.045, -0.40)], "core", 1.7)
    glow_disc(ctx, 0.0, 0.30, 0.10, "main", 1.2)


def _glyph_seeker(ctx: Ctx):
    glow_disc(ctx, 0.0, 0.10, 0.11, "core", 1.5)
    for s in (1, -1):
        glow_poly(ctx, [(s * 0.22, 0.26), (s * 0.40, 0.10), (s * 0.30, -0.30),
                        (s * 0.16, -0.06)], "core", 1.35)


def _glyph_aegis(ctx: Ctx):
    hexa = [(math.cos(a) * 0.40, math.sin(a) * 0.44)
            for a in [math.tau * i / 6 + math.pi / 2 for i in range(6)]]
    glow_line(ctx, hexa + [hexa[0]], "core", 1.5, 2.4)
    glow_disc(ctx, 0.0, 0.0, 0.10, "main", 1.1)


def _glyph_wingman(ctx: Ctx):
    glow_disc(ctx, 0.0, -0.04, 0.15, "core", 1.45)
    for s in (1, -1):
        glow_poly(ctx, [(s * 0.18, 0.06), (s * 0.44, -0.02), (s * 0.42, -0.20),
                        (s * 0.17, -0.14)], "core", 1.25)
    glow_disc(ctx, 0.0, 0.34, 0.07, "main", 1.1)


def _glyph_pulse(ctx: Ctx):
    for r, i in ((0.42, 1.0), (0.28, 1.25), (0.14, 1.6)):
        glow_line(ctx, [(math.cos(t) * r, math.sin(t) * r)
                        for t in [math.tau * k / 24 for k in range(25)]],
                  "core", i, 2.0)


def _glyph_energy(ctx: Ctx):
    glow_poly(ctx, [(0.10, -0.42), (-0.26, 0.06), (-0.02, 0.06),
                    (-0.12, 0.44), (0.26, -0.06), (0.01, -0.06)], "core", 1.7)


GLYPHS = {
    "spread": _glyph_spread, "lance": _glyph_lance, "seeker": _glyph_seeker,
    "aegis": _glyph_aegis, "wingman": _glyph_wingman, "pulse": _glyph_pulse,
    "energy": _glyph_energy,
}


def make_pickup(key: str):
    glyph = GLYPHS[key]

    def draw(ctx: Ctx):
        _housing(ctx)
        glyph(ctx)

    return draw


PICKUPS = {f"pu_{k}": dict(fn=make_pickup(k), size=64, seed=700 + i)
           for i, k in enumerate(GLYPHS)}
