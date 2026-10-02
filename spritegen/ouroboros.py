"""BOSS 3 — OUROBOROS, the foundry leviathan that ends the game.

Bigger than the screen at 2.6x, so the part frames stay modest and the engine
does the scaling. The hull is deliberately industrial rather than ship-like:
by act III the player should feel they are fighting a building.

Parts face DOWN (+y towards the player).
"""
from __future__ import annotations

import math

from .render import (Ctx, disc, glow_disc, glow_line, glow_poly, line, nozzle,
                     plate, rivets)
from .enemies import mir, rot, shrink


# -------------------------------------------------------------------- hull
# A foundry deck: long slab, a central trench, gantries and spill channels.


def hull(ctx: Ctx):
    body = mir([(0.00, 0.86), (0.42, 0.80), (0.78, 0.52), (0.94, 0.06),
                (0.86, -0.44), (0.52, -0.78), (0.00, -0.86)])
    plate(ctx, body, "hull", 1)
    plate(ctx, shrink(body, 0.93), "hull", 2)

    # gantries across the deck
    for y in (0.58, 0.26, -0.08, -0.42):
        plate(ctx, [(-0.88, y + 0.05), (0.88, y + 0.05), (0.86, y - 0.05),
                    (-0.86, y - 0.05)], "hull", 0)
        plate(ctx, [(-0.84, y + 0.03), (0.84, y + 0.03), (0.82, y - 0.02),
                    (-0.82, y - 0.02)], "hull", 3)

    # central trench: the molten channel, the one big emissive run
    plate(ctx, [(-0.20, 0.78), (0.20, 0.78), (0.17, -0.76), (-0.17, -0.76)],
          "dark", 0)
    plate(ctx, [(-0.15, 0.72), (0.15, 0.72), (0.13, -0.70), (-0.13, -0.70)],
          "dark", 1)
    glow_poly(ctx, [(-0.09, 0.70), (0.09, 0.70), (0.075, -0.68),
                    (-0.075, -0.68)], "warn", 0.95)
    glow_poly(ctx, [(-0.035, 0.66), (0.035, 0.66), (0.03, -0.64),
                    (-0.03, -0.64)], "core", 1.25)

    # side plating and spill scars
    for s in (1, -1):
        plate(ctx, [(s * 0.46, 0.74), (s * 0.82, 0.46), (s * 0.90, 0.02),
                    (s * 0.80, -0.44), (s * 0.48, -0.70), (s * 0.40, -0.10)],
              "hull", 2)
        plate(ctx, [(s * 0.52, 0.60), (s * 0.74, 0.40), (s * 0.80, 0.04),
                    (s * 0.72, -0.34), (s * 0.52, -0.54), (s * 0.48, -0.06)],
              "hull", 1)
        plate(ctx, [(s * 0.56, -0.20), (s * 0.74, -0.28), (s * 0.68, -0.52),
                    (s * 0.54, -0.44)], "rust", 1)
        rivets(ctx, [(s * 0.62, 0.52), (s * 0.70, 0.10), (s * 0.60, -0.60)],
               0.026, "hull", 0)
        glow_line(ctx, [(s * 0.42, 0.72), (s * 0.44, -0.66)], "main", 0.7, 1.6)

    # prow
    plate(ctx, mir([(0.00, 0.94), (0.26, 0.86), (0.36, 0.66), (0.00, 0.62)]),
          "hull", 3)
    glow_line(ctx, [(-0.30, 0.74), (0.30, 0.74)], "warn", 0.9, 2.0)


# ----------------------------------------------------------------- cannons
# Six hull guns. Squat, heavily bolted, with a recoil sleeve that reads at
# distance so the fire frame is legible against the enormous hull.


def _cannon(ctx: Ctx, tilt: float):
    base = [(-0.64, -0.46), (0.64, -0.46), (0.72, 0.06), (0.52, 0.38),
            (-0.52, 0.38), (-0.72, 0.06)]
    plate(ctx, base, "hull", 0)
    plate(ctx, shrink(base, 0.86), "hull", 1)
    rivets(ctx, [(-0.50, -0.34), (0.50, -0.34), (-0.42, 0.24), (0.42, 0.24)],
           0.03, "hull", 0)

    a = tilt
    recoil = -0.16 * ctx.muzzle
    barrel = rot([(-0.24, 0.10 + recoil), (0.24, 0.10 + recoil),
                  (0.20, 0.94 + recoil), (-0.20, 0.94 + recoil)], a)
    plate(ctx, barrel, "hull", 1)
    plate(ctx, [(x * 0.82, y) for x, y in barrel], "hull", 3)
    sleeve = rot([(-0.30, 0.16 + recoil), (0.30, 0.16 + recoil),
                  (0.26, 0.44 + recoil), (-0.26, 0.44 + recoil)], a)
    plate(ctx, sleeve, "hull", 2)
    mouth = rot([(-0.22, 0.86 + recoil), (0.22, 0.86 + recoil),
                 (0.20, 0.98 + recoil), (-0.20, 0.98 + recoil)], a)
    plate(ctx, mouth, "hull", 0)

    p = rot([(0.0, 0.92 + recoil)], a)[0]
    glow_disc(ctx, p[0], p[1], 0.06 + 0.07 * ctx.charge, "warn",
              0.9 + 1.1 * ctx.charge)
    glow_line(ctx, [(-0.44, -0.28), (0.44, -0.28)], "main", 0.8, 1.6)


def cannon_a(ctx: Ctx):
    _cannon(ctx, -0.16)


def cannon_b(ctx: Ctx):
    _cannon(ctx, 0.0)


def cannon_c(ctx: Ctx):
    _cannon(ctx, 0.16)


def cannon_d(ctx: Ctx):
    _cannon(ctx, 0.16)


def cannon_e(ctx: Ctx):
    _cannon(ctx, 0.0)


def cannon_f(ctx: Ctx):
    _cannon(ctx, -0.16)


# -------------------------------------------------------------------- arms
# Manipulators that physically sweep the playfield in phase 2. The elbow and
# the claw are what sell "this is going to hit me".


def _arm(ctx: Ctx, s: int):
    upper = [(s * 0.02, 0.44), (s * 0.30, 0.50), (s * 0.44, 0.06),
             (s * 0.16, -0.02)]
    plate(ctx, upper, "hull", 1)
    plate(ctx, shrink(upper, 0.84, 0.2), "hull", 2)

    plate(ctx, [(s * 0.30, 0.16), (s * 0.54, 0.10), (s * 0.56, -0.16),
                (s * 0.32, -0.12)], "hull", 0)

    fore = [(s * 0.34, 0.02), (s * 0.58, -0.04), (s * 0.86, -0.46),
            (s * 0.62, -0.58)]
    plate(ctx, fore, "hull", 1)
    plate(ctx, shrink(fore, 0.86, -0.2), "hull", 3)

    # claw
    for k in (1, -1):
        plate(ctx, [(s * 0.72, -0.44 + k * 0.06), (s * 0.98, -0.62 + k * 0.14),
                    (s * 0.92, -0.76 + k * 0.10), (s * 0.68, -0.56 + k * 0.04)],
              "hull", 2)
    plate(ctx, [(s * 0.66, -0.40), (s * 0.80, -0.48), (s * 0.74, -0.62),
                (s * 0.62, -0.54)], "rust", 1)

    rivets(ctx, [(s * 0.22, 0.30), (s * 0.46, -0.02), (s * 0.70, -0.44)], 0.03)
    glow_line(ctx, [(s * 0.10, 0.38), (s * 0.50, -0.06)], "main", 0.8, 1.8)
    glow_disc(ctx, s * 0.88, -0.60, 0.05 + 0.05 * ctx.charge, "warn",
              1.0 + 0.9 * ctx.charge)


def arm_l(ctx: Ctx):
    _arm(ctx, -1)


def arm_r(ctx: Ctx):
    _arm(ctx, 1)


# ------------------------------------------------------------------- vents
# Core vents. Shut most of the time; `charge` is literally the open state, so
# the 6s window the player must exploit is drawn, not implied.


def vent(ctx: Ctx):
    frame = [(-0.78, -0.62), (0.78, -0.62), (0.86, 0.10), (0.62, 0.66),
             (-0.62, 0.66), (-0.86, 0.10)]
    plate(ctx, frame, "hull", 0)
    plate(ctx, shrink(frame, 0.88), "hull", 1)
    plate(ctx, shrink(frame, 0.70), "dark", 0)

    # louvres slide apart as it opens
    gap = 0.06 + 0.30 * ctx.charge
    for i in (-1, 0, 1):
        y = i * gap
        plate(ctx, [(-0.54, y + 0.09), (0.54, y + 0.09), (0.50, y - 0.09),
                    (-0.50, y - 0.09)], "hull", 2)
        plate(ctx, [(-0.50, y + 0.06), (0.50, y + 0.06), (0.47, y - 0.02),
                    (-0.47, y - 0.02)], "hull", 3)

    if ctx.charge > 0.02:
        glow_poly(ctx, [(-0.50, 0.58), (0.50, 0.58), (0.46, -0.58),
                        (-0.46, -0.58)], "warn", 1.5 * ctx.charge)
        glow_disc(ctx, 0.0, 0.0, 0.16 * ctx.charge, "core", 1.8 * ctx.charge)
    rivets(ctx, [(-0.66, 0.34), (0.66, 0.34), (-0.66, -0.42), (0.66, -0.42)],
           0.03, "hull", 0)


def vent_a(ctx: Ctx):
    vent(ctx)


def vent_b(ctx: Ctx):
    vent(ctx)


def vent_c(ctx: Ctx):
    vent(ctx)


def vent_d(ctx: Ctx):
    vent(ctx)


# -------------------------------------------------------------------- core
# The thing the whole game has been walking towards. In phase 5 it charges an
# 8s beam, so it has the largest emissive area of any sprite in the game.


def core(ctx: Ctx):
    shell = [(math.cos(a) * 0.86, math.sin(a) * 0.86)
             for a in [math.tau * i / 12 for i in range(12)]]
    plate(ctx, shell, "hull", 0)
    plate(ctx, shrink(shell, 0.90), "hull", 1)
    plate(ctx, shrink(shell, 0.74), "hull", 2)
    plate(ctx, shrink(shell, 0.60), "dark", 0)

    for i in range(12):
        a = math.tau * i / 12
        pts = rot([(-0.07, 0.60), (0.07, 0.60), (0.05, 0.84), (-0.05, 0.84)], a)
        plate(ctx, pts, "hull", 3)
        glow_disc(ctx, math.cos(a) * 0.72, math.sin(a) * 0.72, 0.028, "main",
                  0.7 + 0.6 * ctx.charge)

    r = 0.26 + 0.26 * ctx.charge
    glow_disc(ctx, 0.0, 0.0, r * 1.25, "warn", 0.9 + 1.0 * ctx.charge)
    glow_disc(ctx, 0.0, 0.0, r, "core", 1.4 + 0.8 * ctx.charge)
    # the beam aperture itself, pointing at the player
    if ctx.charge > 0.05:
        glow_poly(ctx, [(-0.22 * ctx.charge, 0.0), (0.22 * ctx.charge, 0.0),
                        (0.34 * ctx.charge, 1.0), (-0.34 * ctx.charge, 1.0)],
                  "core", 1.6 * ctx.charge)


GUNS = {
    "cannon_a": (0.0, 0.92), "cannon_b": (0.0, 0.92),
    "cannon_c": (0.0, 0.92), "cannon_d": (0.0, 0.92),
    "cannon_e": (0.0, 0.92), "cannon_f": (0.0, 0.92),
    "core": (0.0, 0.0),
}

ARMED = ("idle", "charge", "fire", "damaged", "destroyed")
STRUCT = ("idle", "damaged", "destroyed")

# Anchors are a fraction of the hull FRAME width, which at this boss's
# scale is ~38 world units. The playfield is only +/-11.5 wide, so every
# damageable part has to sit inside |anchor| ~0.30 or the player simply
# cannot line up a shot with it. A playtest found 6000 HP stranded out of
# reach here, which made the boss unkillable.
PARTS = {
    "hull":     dict(fn=hull, w=512, h=448, seed=301, anchor=(0.0, 0.0),
                     hp=0, states=STRUCT),
    "cannon_a": dict(fn=cannon_a, w=128, h=128, seed=302, anchor=(-0.20, 0.26),
                     hp=600, states=ARMED),
    "cannon_b": dict(fn=cannon_b, w=128, h=128, seed=303, anchor=(-0.25, 0.00),
                     hp=600, states=ARMED),
    "cannon_c": dict(fn=cannon_c, w=128, h=128, seed=304, anchor=(-0.20, -0.26),
                     hp=600, states=ARMED),
    "cannon_d": dict(fn=cannon_d, w=128, h=128, seed=305, anchor=(0.20, -0.26),
                     hp=600, states=ARMED),
    "cannon_e": dict(fn=cannon_e, w=128, h=128, seed=306, anchor=(0.25, 0.00),
                     hp=600, states=ARMED),
    "cannon_f": dict(fn=cannon_f, w=128, h=128, seed=307, anchor=(0.20, 0.26),
                     hp=600, states=ARMED),
    "arm_l":    dict(fn=arm_l, w=224, h=192, seed=308, anchor=(-0.29, 0.18),
                     hp=1200, states=ARMED),
    "arm_r":    dict(fn=arm_r, w=224, h=192, seed=309, anchor=(0.29, 0.18),
                     hp=1200, states=ARMED),
    "vent_a":   dict(fn=vent_a, w=112, h=112, seed=310, anchor=(-0.10, 0.30),
                     hp=800, states=ARMED),
    "vent_b":   dict(fn=vent_b, w=112, h=112, seed=311, anchor=(0.10, 0.30),
                     hp=800, states=ARMED),
    "vent_c":   dict(fn=vent_c, w=112, h=112, seed=312, anchor=(-0.10, -0.30),
                     hp=800, states=ARMED),
    "vent_d":   dict(fn=vent_d, w=112, h=112, seed=313, anchor=(0.10, -0.30),
                     hp=800, states=ARMED),
    "core":     dict(fn=core, w=192, h=192, seed=314, anchor=(0.0, 0.0),
                     hp=4000, states=ARMED),
}

PHASES = [
    {"from": 1.00, "to": 0.75, "pattern": "grid"},
    {"from": 0.75, "to": 0.50, "arms": "sweep", "vents": "open"},
    {"from": 0.50, "to": 0.30, "summon": ["runner", "lance"], "terrain": "collapsing"},
    {"from": 0.30, "to": 0.10, "pattern": "double-spiral"},
    {"from": 0.10, "to": 0.00, "finale": "beam", "corridor": 0.3},
]

META = {
    "id": "ouroboros",
    "name": "OUROBOROS",
    "level": 15,
    "scale": 2.6,
    "screenWidthFraction": 1.35,
    "phases": PHASES,
}
