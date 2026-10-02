"""Parametric definitions for the Act I bestiary.

Every ship draws into a Ctx. Ships face DOWN: nose at +y, engines at -y.
Silhouette rule: each design must stay readable as a solid black shape at 60px.
"""
from __future__ import annotations

import math

from .render import (Ctx, disc, glow_disc, glow_line, glow_poly, line, nozzle,
                     plate, rivets)


def rot(pts, a, cx=0.0, cy=0.0):
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * ca - (y - cy) * sa,
             cy + (x - cx) * sa + (y - cy) * ca) for x, y in pts]


def mir(pts):
    """Close a right-half outline into a symmetric polygon."""
    return list(pts) + [(-x, y) for x, y in reversed(pts)]


def shrink(pts, k, cy=0.0):
    return [(x * k, cy + (y - cy) * k) for x, y in pts]


def muzzle_flash(ctx: Ctx, cx, cy, w=0.16, h=0.34):
    m = ctx.muzzle
    if m <= 0.01:
        return
    glow_poly(ctx, [(cx - w * m, cy), (cx + w * m, cy),
                    (cx + w * 0.28 * m, cy + h * m * 1.6),
                    (cx - w * 0.28 * m, cy + h * m * 1.6)], "warn", 1.8 * m)
    glow_disc(ctx, cx, cy + h * 0.2 * m, w * 0.5 * m, "core", 2.0 * m)


# --------------------------------------------------------------- 01 scrap
# Salvage tug. Asymmetric: a bite taken out of the port side, a welded cargo
# pod on starboard, a crane strut off the bow. Blunt chisel nose.


def scrap(ctx: Ctx):
    plate(ctx, [(-0.78, -0.30), (-0.44, -0.42), (-0.40, -0.20), (-0.72, -0.10)],
          "rust", 1)
    line(ctx, [(-0.74, -0.26), (-0.46, -0.36)], "rust", 3, 1.0)

    plate(ctx, [(0.40, -0.16), (0.74, -0.06), (0.68, 0.30), (0.36, 0.22)],
          "hull", 1)
    plate(ctx, [(0.44, -0.10), (0.68, -0.02), (0.63, 0.22), (0.40, 0.16)],
          "hull", 2)

    hull = [(-0.28, -0.74), (0.34, -0.76), (0.50, -0.38), (0.44, -0.06),
            (0.42, 0.38), (0.22, 0.72), (0.06, 0.86), (-0.10, 0.80), (-0.33, 0.48),
            (-0.24, 0.22), (-0.52, 0.06), (-0.46, -0.36)]
    plate(ctx, hull, "hull", 1)
    plate(ctx, shrink(hull, 0.84), "hull", 2)

    plate(ctx, [(-0.13, -0.64), (0.17, -0.66), (0.14, 0.52), (-0.08, 0.54)],
          "hull", 3)
    plate(ctx, [(-0.05, -0.60), (0.07, -0.61), (0.06, 0.48), (-0.03, 0.49)],
          "hull", 1)

    plate(ctx, [(-0.38, -0.10), (-0.14, -0.02), (-0.19, 0.30), (-0.40, 0.22)],
          "dark", 0)
    plate(ctx, [(-0.33, -0.05), (-0.20, 0.00), (-0.23, 0.18), (-0.34, 0.14)],
          "rust", 2)
    plate(ctx, [(-0.29, 0.02), (-0.23, 0.05), (-0.25, 0.13)], "rust", 3)

    plate(ctx, [(0.20, -0.62), (0.40, -0.54), (0.36, -0.28), (0.18, -0.34)],
          "rust", 1)

    line(ctx, [(-0.26, -0.28), (0.36, -0.30)], "hull", 0, 1.1)
    line(ctx, [(-0.20, 0.34), (0.34, 0.30)], "hull", 0, 1.1)
    rivets(ctx, [(-0.22, -0.52), (0.28, -0.54), (0.32, 0.36), (-0.24, 0.42)])

    nozzle(ctx, 0.10, -0.74, 0.21, 0.44)
    glow_line(ctx, [(-0.30, 0.42), (-0.12, 0.60)], "main", 0.85, 1.7)
    glow_disc(ctx, 0.03, 0.66, 0.06, "warn", 1.15)
    muzzle_flash(ctx, 0.03, 0.72)


# ----------------------------------------------------------- 02 interceptor
# Long dart. Wings swept hard back on thin pylons, so two triangles of
# negative space open between wing and tail.


def interceptor(ctx: Ctx):
    for s in (1, -1):
        plate(ctx, [(s * 0.17, 0.12), (s * 0.94, -0.34), (s * 0.84, -0.56),
                    (s * 0.22, -0.20)], "hull", 1)
        plate(ctx, [(s * 0.20, 0.06), (s * 0.80, -0.34), (s * 0.74, -0.46),
                    (s * 0.24, -0.16)], "hull", 2)
        plate(ctx, [(s * 0.84, -0.30), (s * 0.99, -0.26), (s * 0.92, -0.58),
                    (s * 0.78, -0.54)], "hull", 0)
        plate(ctx, [(s * 0.11, 0.06), (s * 0.19, 0.10), (s * 0.20, -0.12),
                    (s * 0.10, -0.10)], "hull", 0)

    plate(ctx, mir([(0.00, 0.94), (0.07, 0.56), (0.12, 0.10), (0.14, -0.28),
                    (0.09, -0.64), (0.00, -0.70)]), "hull", 1)
    plate(ctx, mir([(0.00, 0.80), (0.05, 0.52), (0.085, 0.08), (0.10, -0.26),
                    (0.06, -0.58), (0.00, -0.62)]), "hull", 3)

    plate(ctx, mir([(0.00, 0.48), (0.065, 0.30), (0.055, 0.04), (0.00, -0.02)]),
          "glass", 1)
    plate(ctx, [(-0.028, 0.38), (0.015, 0.36), (0.008, 0.14), (-0.032, 0.16)],
          "glass", 3)

    line(ctx, [(-0.12, -0.16), (0.12, -0.16)], "hull", 0, 0.9)
    rivets(ctx, [(-0.10, -0.44), (0.10, -0.44)], 0.015)

    for s in (1, -1):
        nozzle(ctx, s * 0.145, -0.66, 0.10, 0.40)
        glow_line(ctx, [(s * 0.26, -0.10), (s * 0.74, -0.40)], "main", 0.85, 1.4)
        glow_disc(ctx, s * 0.91, -0.42, 0.036, "warn", 0.9)
    glow_disc(ctx, 0.0, 0.86, 0.048, "warn", 1.2)
    muzzle_flash(ctx, 0.0, 0.90, 0.13, 0.30)


# ---------------------------------------------------------------- 03 turret
# Ground emplacement seen straight down. Long twin barrels overhang the
# hexagonal base, so the silhouette never reads as a ship.


def turret(ctx: Ctx):
    hexa = [(math.cos(a) * 0.62, math.sin(a) * 0.62)
            for a in [math.tau * i / 6 + math.pi / 6 for i in range(6)]]
    plate(ctx, hexa, "hull", 0)
    plate(ctx, shrink(hexa, 0.88), "hull", 1)
    plate(ctx, shrink(hexa, 0.66), "hull", 2)
    rivets(ctx, shrink(hexa, 0.79), 0.036, "hull", 0)

    a = ctx.spin
    plate(ctx, rot([(-0.30, -0.24), (0.30, -0.24), (0.24, -0.62),
                    (-0.24, -0.62)], a), "hull", 1)
    plate(ctx, rot([(-0.22, -0.30), (0.22, -0.30), (0.18, -0.56),
                    (-0.18, -0.56)], a), "hull", 2)

    for s in (1, -1):
        b = rot([(s * 0.09, 0.10), (s * 0.21, 0.13), (s * 0.20, 1.02),
                 (s * 0.08, 1.00)], a)
        plate(ctx, b, "hull", 1)
        plate(ctx, [(x * 0.92, y * 0.99) for x, y in b], "hull", 3)
        plate(ctx, rot([(s * 0.06, 0.86), (s * 0.24, 0.89), (s * 0.23, 1.03),
                        (s * 0.06, 1.01)], a), "hull", 0)

    dome = [(math.cos(t) * 0.36, math.sin(t) * 0.36)
            for t in [math.tau * i / 12 for i in range(12)]]
    plate(ctx, rot(dome, a), "hull", 2)
    plate(ctx, rot([(x * 0.66, y * 0.66 - 0.05) for x, y in dome], a), "hull", 3)
    line(ctx, rot([(-0.32, -0.12), (0.32, -0.12)], a), "hull", 0, 1.2)

    eye = rot([(0.0, 0.08)], a)[0]
    glow_disc(ctx, eye[0], eye[1], 0.072, "warn", 1.35)
    for s in (1, -1):
        p = rot([(s * 0.15, 0.97)], a)[0]
        glow_disc(ctx, p[0], p[1], 0.042, "main", 1.05)
        if ctx.muzzle > 0.01:
            mp = rot([(s * 0.15, 1.03)], a)[0]
            muzzle_flash(ctx, mp[0], mp[1], 0.12, 0.28)
    for i in range(6):
        ang = math.tau * i / 6 + math.pi / 6
        glow_disc(ctx, math.cos(ang) * 0.46, math.sin(ang) * 0.46, 0.028,
                  "main", 0.7)


# --------------------------------------------------------------- 04 swarmer
# Tiny. Reads by its antenna V, not by its body.


def swarmer(ctx: Ctx):
    for s in (1, -1):
        line(ctx, [(s * 0.14, -0.14), (s * 0.66, -0.80)], "hull", 0, 2.0)
        plate(ctx, [(s * 0.22, 0.02), (s * 0.52, -0.22), (s * 0.44, -0.38),
                    (s * 0.18, -0.14)], "hull", 1)

    body = [(0.0, 0.86), (0.36, 0.04), (0.0, -0.52), (-0.36, 0.04)]
    plate(ctx, body, "hull", 1)
    plate(ctx, shrink(body, 0.68, 0.06), "hull", 3)
    plate(ctx, [(0.0, 0.34), (0.11, 0.04), (0.0, -0.20), (-0.11, 0.04)],
          "dark", 1)

    for s in (1, -1):
        glow_disc(ctx, s * 0.66, -0.80, 0.07, "main", 1.3)
    glow_disc(ctx, 0.0, 0.07, 0.10, "core", 1.2)
    glow_poly(ctx, [(-0.09, -0.30), (0.09, -0.30), (0.045, -0.56),
                    (-0.045, -0.56)], "main", 1.05)
    muzzle_flash(ctx, 0.0, 0.80, 0.11, 0.24)


# ========================================================================
# Acts II and III. Same rules as above: silhouette first, three-tone ramp
# with a hard cut, emissive under 15% of the frame, and a `charge` pose that
# announces anything dangerous.
# ========================================================================


# -------------------------------------------------------------- 05 bulwark
# Heavy slab behind a concave shield plate. The plate has to read as "shield"
# before you read anything else, because shooting the front does nothing.


def bulwark(ctx: Ctx):
    for s in (1, -1):
        plate(ctx, [(s * 0.58, -0.62), (s * 0.86, -0.46), (s * 0.84, 0.10),
                    (s * 0.56, 0.16)], "hull", 0)
        plate(ctx, [(s * 0.62, -0.54), (s * 0.80, -0.44), (s * 0.78, 0.04),
                    (s * 0.60, 0.08)], "rust", 1)

    body = [(-0.60, -0.74), (0.60, -0.74), (0.68, -0.20), (0.62, 0.28),
            (-0.62, 0.28), (-0.68, -0.20)]
    plate(ctx, body, "hull", 1)
    plate(ctx, shrink(body, 0.84), "hull", 2)
    plate(ctx, [(-0.30, -0.64), (0.30, -0.64), (0.26, -0.14), (-0.26, -0.14)],
          "hull", 3)

    # Concave shield: wings reach forward, the middle sits back. This slab has
    # to read as "shield" at 60px, because shooting it head-on does nothing -
    # the player has to learn to flank from the silhouette alone.
    outer, inner = [], []
    for i in range(17):
        t = -1.0 + 2.0 * i / 16
        outer.append((t * 0.92, 0.46 + 0.44 * t * t))
        inner.append((t * 0.80, 0.14 + 0.28 * t * t))
    shell = outer + list(reversed(inner))
    plate(ctx, shell, "hull", 0)
    plate(ctx, [(x * 0.95, y - 0.05) for x, y in outer]
          + [(x * 0.95, y + 0.04) for x, y in reversed(inner)], "hull", 2)
    plate(ctx, [(x * 0.88, y - 0.10) for x, y in outer]
          + [(x * 0.88, y + 0.02) for x, y in reversed(inner)], "hull", 3)
    for i in range(1, 16, 3):
        rivets(ctx, [(inner[i][0], inner[i][1] + 0.06)], 0.026, "hull", 0)

    line(ctx, [(-0.46, -0.30), (0.46, -0.30)], "hull", 0, 1.2)
    for s in (1, -1):
        nozzle(ctx, s * 0.32, -0.78, 0.16, 0.38)
    # the only neon on the front is the shield seam: aim for the flanks
    glow_line(ctx, [(x * 0.9, y + 0.03) for x, y in inner], "main", 0.9, 1.8)
    glow_disc(ctx, 0.0, -0.36, 0.07, "warn", 1.1)
    muzzle_flash(ctx, 0.0, 0.30, 0.14, 0.26)


# ---------------------------------------------------------------- 06 miner
# Bulbous hull with an open cradle underneath. You can see the mines it is
# about to drop, which is the telegraph.


def miner(ctx: Ctx):
    hull = []
    for i in range(17):
        a = math.pi * i / 16
        hull.append((math.cos(a) * 0.62, -0.10 + math.sin(a) * 0.56))
    plate(ctx, hull + [(-0.62, -0.46), (0.62, -0.46)], "hull", 1)
    plate(ctx, shrink(hull, 0.80, -0.06) + [(-0.48, -0.40), (0.48, -0.40)],
          "hull", 2)
    plate(ctx, [(-0.22, 0.24), (0.22, 0.24), (0.18, 0.50), (-0.18, 0.50)],
          "glass", 2)

    # cradle
    plate(ctx, [(-0.50, -0.44), (0.50, -0.44), (0.44, -0.80), (-0.44, -0.80)],
          "dark", 0)
    for s in (1, -1):
        plate(ctx, [(s * 0.50, -0.42), (s * 0.58, -0.46), (s * 0.52, -0.80),
                    (s * 0.44, -0.78)], "hull", 0)
    for k, dx in enumerate((-0.26, 0.0, 0.26)):
        r = 0.13 - 0.02 * (k % 2)
        disc(ctx, dx, -0.60, r, "hull", 0)
        disc(ctx, dx, -0.60, r * 0.6, "rust", 1)
        glow_disc(ctx, dx, -0.60, r * 0.34, "warn", 1.0 + 0.5 * ctx.charge)

    # legs: a bulb on stilts, so it is never mistaken for a plain round hull
    for s in (1, -1):
        plate(ctx, [(s * 0.30, -0.78), (s * 0.40, -0.78), (s * 0.46, -1.00),
                    (s * 0.34, -1.00)], "hull", 0)
        plate(ctx, [(s * 0.26, -0.96), (s * 0.54, -0.96), (s * 0.54, -1.02),
                    (s * 0.26, -1.02)], "hull", 2)
    rivets(ctx, [(-0.40, 0.02), (0.40, 0.02), (0.0, 0.46)], 0.02)
    nozzle(ctx, -0.30, -0.84, 0.12, 0.30)
    nozzle(ctx, 0.30, -0.84, 0.12, 0.30)
    glow_line(ctx, [(-0.54, 0.06), (0.54, 0.06)], "main", 0.8, 1.6)


# ---------------------------------------------------------------- 07 lance
# A needle. Almost no body: the silhouette is a line, and that is the point.


def lance(ctx: Ctx):
    plate(ctx, mir([(0.00, 1.00), (0.05, 0.40), (0.08, -0.20), (0.05, -0.62),
                    (0.00, -0.70)]), "hull", 1)
    plate(ctx, mir([(0.00, 0.92), (0.03, 0.38), (0.045, -0.18),
                    (0.00, -0.56)]), "hull", 3)
    for s in (1, -1):
        plate(ctx, [(s * 0.06, -0.10), (s * 0.30, -0.44), (s * 0.24, -0.56),
                    (s * 0.05, -0.30)], "hull", 0)
        plate(ctx, [(s * 0.07, -0.16), (s * 0.24, -0.44), (s * 0.21, -0.50),
                    (s * 0.06, -0.30)], "rust", 2)
    plate(ctx, [(-0.055, 0.16), (0.055, 0.16), (0.04, -0.02), (-0.04, -0.02)],
          "dark", 1)

    nozzle(ctx, 0.0, -0.66, 0.10, 0.44, intensity=1.0 + 0.9 * ctx.charge)
    # the whole spine lights as it commits: that IS the 0.6s warning
    glow_poly(ctx, [(-0.028, 0.98), (0.028, 0.98), (0.05, 0.10),
                    (-0.05, 0.10)], "warn", 1.1 + 1.0 * ctx.charge)
    glow_disc(ctx, 0.0, 0.07, 0.05, "core", 1.0 + 1.2 * ctx.charge)
    muzzle_flash(ctx, 0.0, 1.0, 0.09, 0.22)


# --------------------------------------------------------------- 08 wraith
# Inverted Y with one big lens. The lens is where the beam comes from, so it
# is also where the eye goes.


def wraith(ctx: Ctx):
    for s in (1, -1):
        arm = [(s * 0.10, 0.04), (s * 0.52, -0.40), (s * 0.74, -0.78),
               (s * 0.58, -0.86), (s * 0.30, -0.44), (s * 0.06, -0.12)]
        plate(ctx, arm, "hull", 1)
        plate(ctx, shrink(arm, 0.88, -0.30), "hull", 2)
        plate(ctx, [(s * 0.60, -0.76), (s * 0.76, -0.82), (s * 0.70, -0.92),
                    (s * 0.56, -0.86)], "hull", 0)

    stem = mir([(0.00, 0.86), (0.16, 0.34), (0.20, 0.02), (0.12, -0.26),
                (0.00, -0.34)])
    plate(ctx, stem, "hull", 1)
    plate(ctx, shrink(stem, 0.82, 0.14), "hull", 3)

    disc(ctx, 0.0, 0.26, 0.26, "hull", 0)
    disc(ctx, 0.0, 0.26, 0.21, "glass", 1)
    disc(ctx, -0.06, 0.32, 0.08, "glass", 3)

    line(ctx, [(-0.18, -0.14), (0.18, -0.14)], "hull", 0, 1.0)
    rivets(ctx, [(-0.14, -0.24), (0.14, -0.24)], 0.018)
    for s in (1, -1):
        nozzle(ctx, s * 0.14, -0.34, 0.09, 0.28)
        glow_disc(ctx, s * 0.70, -0.82, 0.04, "main", 0.9)
    # lens charges through the 1.2s aim, so the laser is never a surprise
    glow_disc(ctx, 0.0, 0.26, 0.10 + 0.09 * ctx.charge, "warn",
              0.9 + 1.2 * ctx.charge)
    glow_disc(ctx, 0.0, 0.26, 0.04 + 0.05 * ctx.charge, "core",
              1.2 + 1.0 * ctx.charge)
    muzzle_flash(ctx, 0.0, 0.52, 0.12, 0.30)


# ------------------------------------------------------------- 09 splitter
# Two modules on one visible joint. You have to be able to predict the split,
# so the seam is the loudest line on the sprite.


def splitter(ctx: Ctx):
    for s in (1, -1):
        # modules stand apart; only the short spine bridges them, so the
        # silhouette pinches in the middle instead of reading as one mass
        mod = [(s * 0.24, 0.64), (s * 0.62, 0.42), (s * 0.74, -0.16),
               (s * 0.56, -0.64), (s * 0.26, -0.72)]
        plate(ctx, mod, "hull", 1)
        plate(ctx, shrink(mod, 0.80, -0.04), "hull", 2)
        plate(ctx, [(s * 0.30, 0.30), (s * 0.54, 0.16), (s * 0.50, -0.14),
                    (s * 0.28, -0.06)], "hull", 3)
        plate(ctx, [(s * 0.34, -0.34), (s * 0.52, -0.42), (s * 0.46, -0.58),
                    (s * 0.30, -0.50)], "rust", 1)
        nozzle(ctx, s * 0.34, -0.66, 0.12, 0.32)
        glow_disc(ctx, s * 0.62, -0.10, 0.05, "main", 0.95)

    # the joint
    plate(ctx, [(-0.13, 0.30), (0.13, 0.30), (0.11, -0.38), (-0.11, -0.38)],
          "dark", 0)
    for y in (0.18, -0.04, -0.26):
        plate(ctx, [(-0.14, y + 0.05), (0.14, y + 0.05), (0.14, y - 0.05),
                    (-0.14, y - 0.05)], "hull", 0)
        glow_poly(ctx, [(-0.10, y + 0.025), (0.10, y + 0.025),
                        (0.10, y - 0.025), (-0.10, y - 0.025)], "warn", 1.15)
    glow_disc(ctx, 0.0, 0.62, 0.06, "core", 1.1)
    muzzle_flash(ctx, 0.0, 0.66, 0.12, 0.26)


# --------------------------------------------------------------- 10 runner
# Phase runner. A doubled, offset outline reads as "this thing is not quite
# here" even in a solid-black silhouette test.


def runner(ctx: Ctx):
    # concave-sided dart: the notched waist is what separates it from the
    # miner and the splitter at 60px
    ghost = [(0.00, 0.86), (0.30, 0.30), (0.62, 0.06), (0.34, -0.10),
             (0.46, -0.64), (0.14, -0.44), (0.00, -0.72), (-0.14, -0.44),
             (-0.46, -0.64), (-0.34, -0.10), (-0.62, 0.06), (-0.30, 0.30)]
    # trailing echo: kept under the alpha the silhouette test reads, so the
    # ghost never bloats the shape it is supposed to haunt
    plate(ctx, [(x + 0.12, y - 0.14) for x, y in ghost], "dark", 2, alpha=78)
    plate(ctx, [(x - 0.10, y - 0.08) for x, y in ghost], "dark", 1, alpha=58)

    plate(ctx, ghost, "hull", 1)
    plate(ctx, shrink(ghost, 0.78), "hull", 2)
    plate(ctx, [(0.00, 0.50), (0.22, 0.16), (0.00, -0.14), (-0.22, 0.16)],
          "hull", 3)
    plate(ctx, [(0.00, 0.34), (0.10, 0.14), (0.00, -0.04), (-0.10, 0.14)],
          "dark", 0)

    for s in (1, -1):
        nozzle(ctx, s * 0.20, -0.44, 0.09, 0.28)
    rivets(ctx, [(-0.32, 0.10), (0.32, 0.10)], 0.02)

    glow_disc(ctx, 0.0, 0.16, 0.09, "core", 1.15 + 0.7 * ctx.charge)
    for s in (1, -1):
        glow_line(ctx, [(s * 0.16, 0.44), (s * 0.44, 0.06)], "main", 0.9, 1.5)
    muzzle_flash(ctx, 0.0, 0.74, 0.12, 0.28)


# ---------------------------------------------------------------- 11 barge
# Flat, wide, exposed truss. Slow enough that you read the whole arc coming.


def barge(ctx: Ctx):
    deck = [(-0.94, -0.30), (-0.78, 0.18), (-0.30, 0.34), (0.30, 0.34),
            (0.78, 0.18), (0.94, -0.30), (0.72, -0.52), (-0.72, -0.52)]
    plate(ctx, deck, "hull", 1)
    plate(ctx, shrink(deck, 0.88), "hull", 2)

    # exposed truss
    for i in range(-3, 4):
        x = i * 0.21
        line(ctx, [(x, 0.28), (x * 0.86, -0.46)], "hull", 0, 1.0)
    line(ctx, [(-0.84, -0.06), (0.84, -0.06)], "hull", 0, 1.4)
    line(ctx, [(-0.74, 0.16), (0.74, 0.16)], "hull", 0, 1.1)

    for s in (1, -1):
        plate(ctx, [(s * 0.58, 0.20), (s * 0.86, 0.06), (s * 0.82, -0.26),
                    (s * 0.56, -0.20)], "hull", 3)
        plate(ctx, [(s * 0.62, 0.14), (s * 0.78, 0.04), (s * 0.76, -0.18),
                    (s * 0.60, -0.14)], "rust", 1)
        nozzle(ctx, s * 0.52, -0.56, 0.15, 0.34)

    # gun deck across the bow: twelve ports, one per shot in the barrage
    plate(ctx, [(-0.68, 0.34), (0.68, 0.34), (0.60, 0.56), (-0.60, 0.56)],
          "hull", 0)
    plate(ctx, [(-0.62, 0.36), (0.62, 0.36), (0.56, 0.50), (-0.56, 0.50)],
          "hull", 2)
    for i in range(12):
        x = -0.56 + 1.12 * i / 11
        glow_disc(ctx, x, 0.46, 0.026, "warn", 0.8 + 0.9 * ctx.charge)
    rivets(ctx, [(-0.78, -0.36), (0.78, -0.36), (0.0, -0.42)], 0.024)
    glow_line(ctx, [(-0.88, -0.28), (0.88, -0.28)], "main", 0.75, 1.6)
    muzzle_flash(ctx, 0.0, 0.58, 0.20, 0.34)


SHIPS = {
    "scrap": dict(fn=scrap, size=128, seed=11),
    "interceptor": dict(fn=interceptor, size=128, seed=22),
    "turret": dict(fn=turret, size=128, seed=33),
    "swarmer": dict(fn=swarmer, size=64, seed=44),
    "bulwark": dict(fn=bulwark, size=192, seed=55),
    "miner": dict(fn=miner, size=128, seed=66),
    "lance": dict(fn=lance, size=128, seed=77),
    "wraith": dict(fn=wraith, size=128, seed=88),
    "splitter": dict(fn=splitter, size=128, seed=99),
    "runner": dict(fn=runner, size=128, seed=110),
    "barge": dict(fn=barge, size=192, seed=121),
}

# Which bestiary entries an act actually fields. The hull art never changes
# between acts - only the emissive palette does - so an act atlas simply
# re-renders the ships that act uses (spec 3, 9).
ACT_SHIPS = {
    1: ["scrap", "interceptor", "turret", "swarmer"],
    2: ["scrap", "interceptor", "turret", "swarmer",
        "bulwark", "miner", "lance", "wraith"],
    3: ["scrap", "interceptor", "turret", "swarmer",
        "bulwark", "miner", "lance", "wraith",
        "splitter", "runner", "barge"],
}


def ships_for_act(act: int) -> dict:
    return {k: SHIPS[k] for k in ACT_SHIPS.get(act, list(SHIPS))}
