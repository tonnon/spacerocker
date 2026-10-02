"""BOSS 2 — BASILISK, the serpent battleship at the end of Act II.

Same contract as the Hexapod: every part is its own frame set, assembled by
the engine at the published anchors. The anchors here are only starting
positions — the body undulates, so the engine rewrites seg/turret anchors
every frame from a travelling sine (and coils them into a ring in phase 2).

Parts face DOWN (+y towards the player), like everything else.
"""
from __future__ import annotations

import math

from .render import (Ctx, disc, glow_disc, glow_line, glow_poly, line, nozzle,
                     plate, rivets)
from .enemies import mir, rot, shrink


# -------------------------------------------------------------------- head
# Armoured skull. Invulnerable in phase 1, so it has to look like the worst
# possible place to shoot: heavy brow, no seams, a single sighting slit.


def head(ctx: Ctx):
    jaw = mir([(0.00, 0.94), (0.26, 0.74), (0.44, 0.38), (0.50, -0.06),
               (0.40, -0.48), (0.00, -0.62)])
    plate(ctx, jaw, "hull", 1)
    plate(ctx, shrink(jaw, 0.88, 0.04), "hull", 2)

    # brow: one solid slab, no panel lines to shoot at
    brow = mir([(0.00, 0.60), (0.30, 0.48), (0.44, 0.18), (0.40, -0.18),
                (0.00, -0.30)])
    plate(ctx, brow, "hull", 3)
    plate(ctx, shrink(brow, 0.82, 0.08), "hull", 2)

    for s in (1, -1):
        plate(ctx, [(s * 0.40, 0.30), (s * 0.66, 0.10), (s * 0.62, -0.26),
                    (s * 0.38, -0.16)], "hull", 0)
        plate(ctx, [(s * 0.43, 0.24), (s * 0.60, 0.09), (s * 0.57, -0.19),
                    (s * 0.41, -0.13)], "rust", 1)
        rivets(ctx, [(s * 0.50, 0.02)], 0.03, "hull", 0)

    # mandibles
    for s in (1, -1):
        plate(ctx, [(s * 0.14, 0.86), (s * 0.34, 0.60), (s * 0.28, 0.34),
                    (s * 0.10, 0.56)], "hull", 0)

    line(ctx, [(-0.34, -0.36), (0.34, -0.36)], "hull", 0, 1.6)
    # the only opening: a sighting slit that ramps with the charge
    glow_poly(ctx, [(-0.30, 0.22), (0.30, 0.22), (0.24, 0.06), (-0.24, 0.06)],
              "warn", 1.0 + 0.9 * ctx.charge)
    glow_disc(ctx, 0.0, 0.14, 0.06 + 0.05 * ctx.charge, "core",
              1.1 + 1.0 * ctx.charge)
    for s in (1, -1):
        glow_disc(ctx, s * 0.62, -0.08, 0.035, "main", 0.85)


# ---------------------------------------------------------------- segments
# Four armoured rings. They shrink towards the tail so the body reads as a
# tapering snake even when the engine has scattered them.


def _segment(ctx: Ctx, k: float):
    w = 0.92 - 0.10 * k
    body = mir([(0.00, 0.74), (w * 0.72, 0.60), (w, 0.16), (w * 0.92, -0.28),
                (w * 0.58, -0.66), (0.00, -0.76)])
    plate(ctx, body, "hull", 1)
    plate(ctx, shrink(body, 0.86), "hull", 2)

    # ring rib
    plate(ctx, mir([(0.00, 0.30), (w * 0.86, 0.18), (w * 0.88, -0.06),
                    (0.00, -0.14)]), "hull", 3)
    plate(ctx, mir([(0.00, 0.22), (w * 0.70, 0.13), (w * 0.72, -0.02),
                    (0.00, -0.08)]), "hull", 1)

    for s in (1, -1):
        plate(ctx, [(s * w * 0.86, 0.34), (s * (w + 0.10), 0.12),
                    (s * (w + 0.06), -0.22), (s * w * 0.82, -0.14)], "hull", 0)
        plate(ctx, [(s * w * 0.40, -0.40), (s * w * 0.66, -0.50),
                    (s * w * 0.58, -0.70), (s * w * 0.34, -0.60)], "rust", 1)
        glow_disc(ctx, s * (w + 0.06), -0.04, 0.032, "main", 0.8)

    rivets(ctx, [(-w * 0.5, 0.52), (w * 0.5, 0.52), (-w * 0.5, -0.50),
                 (w * 0.5, -0.50)], 0.028)
    glow_line(ctx, [(-w * 0.74, 0.06), (w * 0.74, 0.06)], "main", 0.75, 1.8)


def seg_a(ctx: Ctx):
    _segment(ctx, 0)


def seg_b(ctx: Ctx):
    _segment(ctx, 1)


def seg_c(ctx: Ctx):
    _segment(ctx, 2)


def seg_d(ctx: Ctx):
    _segment(ctx, 3)


# ----------------------------------------------------------------- turrets
# Twin-barrel domes that ride the segments. Barrels are long enough to read
# as a threat against the segment plating behind them.


def _turret(ctx: Ctx, tilt: float):
    base = [(math.cos(a) * 0.60, math.sin(a) * 0.60)
            for a in [math.tau * i / 8 + math.pi / 8 for i in range(8)]]
    plate(ctx, base, "hull", 0)
    plate(ctx, shrink(base, 0.86), "hull", 1)
    plate(ctx, shrink(base, 0.62), "hull", 2)

    a = tilt + 0.34 * ctx.bank
    for s in (1, -1):
        b = rot([(s * 0.10, 0.18), (s * 0.24, 0.22), (s * 0.22, 0.96),
                 (s * 0.09, 0.92)], a)
        plate(ctx, b, "hull", 1)
        plate(ctx, [(x * 0.9, y * 0.99) for x, y in b], "hull", 3)
        p = rot([(s * 0.16, 0.90)], a)[0]
        glow_disc(ctx, p[0], p[1], 0.04, "warn", 0.9 + 1.0 * ctx.charge)

    dome = [(math.cos(t) * 0.34, math.sin(t) * 0.34)
            for t in [math.tau * i / 12 for i in range(12)]]
    plate(ctx, rot(dome, a), "hull", 2)
    plate(ctx, rot([(x * 0.64, y * 0.64) for x, y in dome], a), "hull", 3)
    glow_disc(ctx, 0.0, 0.0, 0.07, "core", 1.0 + 0.8 * ctx.charge)
    rivets(ctx, shrink(base, 0.76), 0.026, "hull", 0)


def turret_a(ctx: Ctx):
    _turret(ctx, 0.0)


def turret_b(ctx: Ctx):
    _turret(ctx, 0.22)


def turret_c(ctx: Ctx):
    _turret(ctx, -0.22)


def turret_d(ctx: Ctx):
    _turret(ctx, 0.1)


# --------------------------------------------------------------- thrusters
# The tail drives. In phase 3 they are on fire, which is why they have the
# biggest exhaust bells on the boss.


def _thruster(ctx: Ctx, s: int):
    body = [(s * 0.10, 0.62), (s * 0.72, 0.44), (s * 0.84, -0.18),
            (s * 0.56, -0.62), (s * 0.06, -0.58)]
    plate(ctx, body, "hull", 1)
    plate(ctx, shrink(body, 0.84, -0.02), "hull", 2)
    plate(ctx, [(s * 0.22, 0.40), (s * 0.62, 0.26), (s * 0.66, -0.10),
                (s * 0.26, -0.02)], "hull", 3)
    plate(ctx, [(s * 0.30, -0.24), (s * 0.60, -0.34), (s * 0.52, -0.56),
                (s * 0.26, -0.46)], "rust", 1)

    for i, off in enumerate((-0.14, 0.18)):
        nozzle(ctx, s * (0.34 + i * 0.26), -0.66 + off * 0,
               0.17, 0.52, intensity=1.0 + 0.8 * ctx.charge)
    line(ctx, [(s * 0.14, 0.10), (s * 0.78, -0.04)], "hull", 0, 1.3)
    rivets(ctx, [(s * 0.30, 0.46), (s * 0.68, 0.06)], 0.03)
    glow_line(ctx, [(s * 0.18, 0.52), (s * 0.74, 0.32)], "main", 0.85, 1.8)


def thruster_l(ctx: Ctx):
    _thruster(ctx, -1)


def thruster_r(ctx: Ctx):
    _thruster(ctx, 1)


# -------------------------------------------------------------------- core
# Sits inside the fourth segment. Sealed behind an iris until phase 4, so the
# shutter is the most prominent thing on it.


def core(ctx: Ctx):
    shell = [(math.cos(a) * 0.82, math.sin(a) * 0.82)
             for a in [math.tau * i / 10 + math.pi / 10 for i in range(10)]]
    plate(ctx, shell, "hull", 0)
    plate(ctx, shrink(shell, 0.88), "hull", 1)
    plate(ctx, shrink(shell, 0.70), "dark", 0)

    # iris shutters retract as the core charges
    openness = 0.25 + 0.65 * ctx.charge
    for i in range(6):
        a = math.tau * i / 6
        d = 0.30 + 0.34 * openness
        pts = rot([(-0.26, 0.10), (0.26, 0.10), (0.20, 0.40), (-0.20, 0.40)], a)
        plate(ctx, [(x + math.cos(a) * d * 0.3, y + math.sin(a) * d * 0.3)
                    for x, y in pts], "hull", 2)

    r = 0.20 + 0.16 * ctx.charge
    glow_disc(ctx, 0.0, 0.0, r, "warn", 1.2 + 0.9 * ctx.charge)
    glow_disc(ctx, 0.0, 0.0, r * 0.55, "core", 1.6 + 0.9 * ctx.charge)
    for i in range(10):
        a = math.tau * i / 10 + math.pi / 10
        glow_disc(ctx, math.cos(a) * 0.74, math.sin(a) * 0.74, 0.03, "main", 0.8)


GUNS = {
    "head": (0.0, 0.14),
    "turret_a": (0.0, 0.92), "turret_b": (0.0, 0.92),
    "turret_c": (0.0, 0.92), "turret_d": (0.0, 0.92),
    "core": (0.0, 0.0),
}

ARMED = ("idle", "charge", "fire", "damaged", "destroyed")
STRUCT = ("idle", "damaged", "destroyed")

PARTS = {
    "head":       dict(fn=head, w=224, h=224, seed=201, anchor=(0.0, 0.46),
                       hp=600, states=ARMED),
    "seg_a":      dict(fn=seg_a, w=208, h=176, seed=202, anchor=(0.0, 0.14),
                       hp=0, states=STRUCT),
    "seg_b":      dict(fn=seg_b, w=200, h=172, seed=203, anchor=(0.0, -0.14),
                       hp=0, states=STRUCT),
    "seg_c":      dict(fn=seg_c, w=192, h=168, seed=204, anchor=(0.0, -0.42),
                       hp=0, states=STRUCT),
    "seg_d":      dict(fn=seg_d, w=184, h=164, seed=205, anchor=(0.0, -0.70),
                       hp=0, states=STRUCT),
    "turret_a":   dict(fn=turret_a, w=128, h=128, seed=206, anchor=(0.0, 0.16),
                       hp=500, states=ARMED),
    "turret_b":   dict(fn=turret_b, w=128, h=128, seed=207, anchor=(0.0, -0.12),
                       hp=500, states=ARMED),
    "turret_c":   dict(fn=turret_c, w=128, h=128, seed=208, anchor=(0.0, -0.40),
                       hp=500, states=ARMED),
    "turret_d":   dict(fn=turret_d, w=128, h=128, seed=209, anchor=(0.0, -0.68),
                       hp=500, states=ARMED),
    "thruster_l": dict(fn=thruster_l, w=160, h=160, seed=210, anchor=(-0.34, -0.92),
                       hp=700, states=ARMED),
    "thruster_r": dict(fn=thruster_r, w=160, h=160, seed=211, anchor=(0.34, -0.92),
                       hp=700, states=ARMED),
    "core":       dict(fn=core, w=176, h=176, seed=212, anchor=(0.0, -0.42),
                       hp=1800, states=ARMED),
}

PHASES = [
    {"from": 1.00, "to": 0.70, "entry": "side", "turrets": "track"},
    {"from": 0.70, "to": 0.40, "coil": True, "wall": "rotating-gap"},
    {"from": 0.40, "to": 0.15, "thrusters": "burning", "charge": "diagonal"},
    {"from": 0.15, "to": 0.00, "segments": "independent", "core": "beam"},
]

META = {
    "id": "basilisk",
    "name": "BASILISK",
    "level": 10,
    "scale": 1.8,
    "screenWidthFraction": 0.78,
    "phases": PHASES,
}
