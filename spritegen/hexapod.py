"""BOSS 1 — HEXAPOD, the carrier at the end of Act I.

Drawn as separate destructible parts so the engine can kill a pod without
killing the hull. Each part is its own frame set; the engine assembles them
at the anchor offsets published in the atlas JSON.

Anchors are in hull-frame normalised units (x across the hull width).
"""
from __future__ import annotations

import math

from .render import (Ctx, disc, glow_disc, glow_line, glow_poly, line, nozzle,
                     plate, rivets)
from .enemies import mir, rot, shrink


# ------------------------------------------------------------------- hull


def hull(ctx: Ctx):
    # six landing/grapple struts, three per side, drawn under the hull
    for s in (1, -1):
        for i, (y0, ln) in enumerate([(-0.34, 0.30), (0.02, 0.38), (0.36, 0.30)]):
            plate(ctx, [(s * 0.72, y0 - 0.07), (s * (0.72 + ln), y0 - 0.16),
                        (s * (0.76 + ln), y0 + 0.02), (s * 0.74, y0 + 0.09)],
                  "hull", 0)
            plate(ctx, [(s * 0.74, y0 - 0.04), (s * (0.72 + ln), y0 - 0.11),
                        (s * (0.74 + ln), y0 - 0.02), (s * 0.75, y0 + 0.04)],
                  "hull", 2)
            glow_disc(ctx, s * (0.76 + ln), y0 - 0.05, 0.022, "main", 0.8)

    body = mir([(0.00, 0.74), (0.34, 0.62), (0.62, 0.34), (0.74, 0.02),
                (0.66, -0.36), (0.40, -0.62), (0.00, -0.70)])
    plate(ctx, body, "hull", 1)
    plate(ctx, shrink(body, 0.90), "hull", 2)

    # armour belt
    plate(ctx, mir([(0.00, 0.50), (0.30, 0.42), (0.50, 0.20), (0.56, -0.02),
                    (0.48, -0.30), (0.28, -0.46), (0.00, -0.52)]), "hull", 1)

    # dorsal spine
    plate(ctx, [(-0.13, -0.64), (0.13, -0.64), (0.10, 0.66), (-0.10, 0.66)],
          "hull", 3)
    plate(ctx, [(-0.05, -0.60), (0.05, -0.60), (0.04, 0.62), (-0.04, 0.62)],
          "hull", 1)

    # command tower, aft
    plate(ctx, mir([(0.00, -0.30), (0.20, -0.36), (0.24, -0.54), (0.00, -0.60)]),
          "hull", 2)
    plate(ctx, mir([(0.00, -0.36), (0.12, -0.40), (0.14, -0.51), (0.00, -0.55)]),
          "glass", 1)
    glow_line(ctx, [(-0.13, -0.45), (0.13, -0.45)], "main", 0.9, 1.4)

    # bay recess — the bay part is composited into this well
    plate(ctx, [(-0.30, 0.04), (0.30, 0.04), (0.30, 0.46), (-0.30, 0.46)],
          "dark", 0)
    plate(ctx, [(-0.27, 0.07), (0.27, 0.07), (0.27, 0.43), (-0.27, 0.43)],
          "dark", 1)

    # pod sockets
    for s in (1, -1):
        plate(ctx, [(s * 0.40, -0.10), (s * 0.66, -0.14), (s * 0.68, 0.14),
                    (s * 0.42, 0.16)], "hull", 0)
        rivets(ctx, [(s * 0.46, -0.06), (s * 0.60, -0.08), (s * 0.60, 0.10),
                     (s * 0.46, 0.12)], 0.016)

    # plating
    for y in (-0.44, -0.20, 0.52):
        line(ctx, [(-0.56, y), (0.56, y)], "hull", 0, 1.3)
    for s in (1, -1):
        line(ctx, [(s * 0.22, -0.60), (s * 0.34, 0.60)], "hull", 0, 1.1)
        plate(ctx, [(s * 0.36, 0.30), (s * 0.56, 0.20), (s * 0.52, 0.46),
                    (s * 0.34, 0.50)], "hull", 2)
    rivets(ctx, [(-0.44, 0.54), (0.44, 0.54), (-0.50, -0.38), (0.50, -0.38)],
           0.02)
    # greebles: vents, conduit runs, service hatches
    for s2 in (1, -1):
        for k in range(4):
            plate(ctx, [(s2 * (0.30 + k * 0.05), -0.56 + k * 0.015),
                        (s2 * (0.33 + k * 0.05), -0.56 + k * 0.015),
                        (s2 * (0.33 + k * 0.05), -0.30),
                        (s2 * (0.30 + k * 0.05), -0.30)], "hull", 0)
        plate(ctx, [(s2 * 0.16, 0.50), (s2 * 0.30, 0.48), (s2 * 0.28, 0.62),
                    (s2 * 0.15, 0.63)], "hull", 0)
        plate(ctx, [(s2 * 0.18, 0.52), (s2 * 0.27, 0.51), (s2 * 0.26, 0.60),
                    (s2 * 0.17, 0.61)], "hull", 2)
        for k in range(3):
            line(ctx, [(s2 * 0.34, -0.06 + k * 0.07), (s2 * 0.56, -0.04 + k * 0.07)],
                 "hull", 3, 0.8)
        plate(ctx, [(s2 * 0.44, -0.30), (s2 * 0.60, -0.26), (s2 * 0.57, -0.16),
                    (s2 * 0.42, -0.20)], "hull", 2)

    # four main engines across the stern
    for cx in (-0.42, -0.15, 0.15, 0.42):
        nozzle(ctx, cx, -0.68, 0.11, 0.22)

    # running lights along the hull edge
    for s in (1, -1):
        for y in (0.46, 0.10, -0.28):
            glow_disc(ctx, s * 0.60, y, 0.025, "main", 0.85)
    # bow floodlights
    glow_poly(ctx, [(-0.20, 0.70), (0.20, 0.70), (0.12, 0.60), (-0.12, 0.60)],
              "warn", 0.75)


# -------------------------------------------------------------- gun pods


def _pod(ctx: Ctx, s: int):
    housing = [(s * -0.62, -0.58), (s * 0.52, -0.62), (s * 0.66, -0.10),
               (s * 0.54, 0.34), (s * 0.22, 0.52), (s * -0.42, 0.44),
               (s * -0.64, 0.00)]
    plate(ctx, housing, "hull", 1)
    plate(ctx, shrink(housing, 0.84), "hull", 2)

    # shield collar facing the player
    plate(ctx, [(s * -0.48, 0.30), (s * 0.40, 0.36), (s * 0.30, 0.62),
                (s * -0.40, 0.56)], "hull", 0)
    line(ctx, [(s * -0.40, 0.44), (s * 0.32, 0.48)], "hull", 3, 1.2)

    # twin barrels
    for k, off in enumerate((-0.20, 0.14)):
        plate(ctx, [(s * (off - 0.09), 0.30), (s * (off + 0.09), 0.32),
                    (s * (off + 0.08), 0.96), (s * (off - 0.08), 0.94)],
              "hull", 1)
        plate(ctx, [(s * (off - 0.04), 0.32), (s * (off + 0.04), 0.33),
                    (s * (off + 0.035), 0.94), (s * (off - 0.035), 0.93)],
              "hull", 3)
        glow_disc(ctx, s * off, 0.93, 0.05, "main", 1.0 + 0.2 * k)
        if ctx.muzzle > 0.01:
            m = ctx.muzzle
            glow_poly(ctx, [(s * (off - 0.16 * m), 0.94),
                            (s * (off + 0.16 * m), 0.94),
                            (s * (off + 0.05 * m), 0.94 + 0.5 * m),
                            (s * (off - 0.05 * m), 0.94 + 0.5 * m)],
                      "warn", 1.9 * m)
            glow_disc(ctx, s * off, 0.99, 0.09 * m, "core", 2.0 * m)

    # ammo feed + heat sink
    plate(ctx, [(s * -0.56, -0.40), (s * -0.10, -0.50), (s * -0.06, -0.14),
                (s * -0.52, -0.06)], "hull", 0)
    for i in range(4):
        line(ctx, [(s * -0.52, -0.42 + i * 0.09), (s * -0.14, -0.50 + i * 0.09)],
             "hull", 2, 0.9)
    rivets(ctx, [(s * 0.40, -0.44), (s * 0.48, -0.06), (s * 0.34, 0.26)], 0.024)
    glow_line(ctx, [(s * 0.10, -0.52), (s * 0.44, -0.28)], "main", 0.9, 1.6)
    # weak point
    glow_disc(ctx, s * -0.10, 0.02, 0.09, "warn", 1.2)


def pod_r(ctx: Ctx):
    _pod(ctx, 1)


def pod_l(ctx: Ctx):
    _pod(ctx, -1)


# ------------------------------------------------------------ launch bay


def bay(ctx: Ctx):
    frame = [(-0.92, -0.52), (0.92, -0.52), (0.92, 0.52), (-0.92, 0.52)]
    plate(ctx, frame, "hull", 0)
    plate(ctx, shrink(frame, 0.94), "hull", 1)
    plate(ctx, [(-0.78, -0.38), (0.78, -0.38), (0.78, 0.38), (-0.78, 0.38)],
          "dark", 0)

    # interior: launch rails, lit from within as the doors open
    op = ctx.charge  # 0 closed .. 1 fully open
    if op > 0.02:
        glow_poly(ctx, [(-0.74, -0.34), (0.74, -0.34), (0.74, 0.34),
                        (-0.74, 0.34)], "main", 0.30 * op)
        for x in (-0.44, 0.0, 0.44):
            glow_line(ctx, [(x, -0.30), (x, 0.30)], "core", 0.75 * op, 1.3)
        glow_disc(ctx, 0.0, 0.0, 0.13 * op, "core", 1.15 * op)

    # sliding doors
    slide = 0.46 * op
    for s in (1, -1):
        d = [(s * (0.02 + slide), -0.36), (s * (0.80 + slide), -0.36),
             (s * (0.80 + slide), 0.36), (s * (0.02 + slide), 0.36)]
        plate(ctx, d, "hull", 1)
        plate(ctx, shrink(d, 0.92), "hull", 2)
        for i in range(3):
            line(ctx, [(s * (0.10 + slide), -0.24 + i * 0.24),
                       (s * (0.72 + slide), -0.24 + i * 0.24)], "hull", 0, 1.0)
        glow_line(ctx, [(s * (0.06 + slide), -0.30), (s * (0.06 + slide), 0.30)],
                  "warn", 0.9, 1.4)

    rivets(ctx, [(-0.84, -0.44), (0.84, -0.44), (-0.84, 0.44), (0.84, 0.44)],
           0.026)
    for s in (1, -1):
        glow_disc(ctx, s * 0.86, 0.0, 0.03, "main", 0.9)


# ------------------------------------------------------------------ core


def core(ctx: Ctx):
    # armoured iris
    ring = [(math.cos(t) * 0.92, math.sin(t) * 0.92)
            for t in [math.tau * i / 16 for i in range(16)]]
    plate(ctx, ring, "hull", 0)
    plate(ctx, shrink(ring, 0.88), "hull", 1)
    for i in range(8):
        a = math.tau * i / 8 + ctx.spin * 0.25
        blade = rot([(-0.12, 0.34), (0.12, 0.34), (0.20, 0.82), (-0.04, 0.84)], a)
        plate(ctx, blade, "hull", 2)
        plate(ctx, [(x * 0.94, y * 0.94) for x, y in blade], "hull", 3)
    plate(ctx, shrink(ring, 0.36), "dark", 0)

    # plasma core
    pulse = 0.9 + 0.35 * math.sin(ctx.spin * 2.0)
    glow_disc(ctx, 0, 0, 0.26, "main", 0.62 * pulse)
    glow_disc(ctx, 0, 0, 0.15, "core", 1.05 * pulse)
    for i in range(3):
        a = math.tau * i / 3 - ctx.spin * 0.8
        glow_line(ctx, [(math.cos(a) * 0.12, math.sin(a) * 0.12),
                        (math.cos(a) * 0.46, math.sin(a) * 0.46)],
                  "core", 0.75 * pulse, 1.2)
    rivets(ctx, [(math.cos(math.tau * i / 8) * 0.80,
                  math.sin(math.tau * i / 8) * 0.80) for i in range(8)], 0.03)


GUNS = {"pod_l": (0.03, 0.88), "pod_r": (-0.03, 0.88), "core": (0.0, 0.0)}

PHASES = [
    {"from": 1.00, "to": 0.60, "pods": "alternate", "bay": "launch"},
    {"from": 0.60, "to": 0.25, "pods": "salvo", "sweep": True},
    {"from": 0.25, "to": 0.00, "core": "exposed", "spiral": True},
]

META = {
    "id": "hexapod",
    "name": "HEXAPOD",
    "level": 5,
    "scale": 1.0,
    "screenWidthFraction": 0.45,
    "phases": PHASES,
}

PARTS = {
    "hull":  dict(fn=hull,  w=448, h=416, seed=101, anchor=(0.0, 0.0),
                  hp=0, states=("idle", "damaged", "destroyed")),
    "pod_l": dict(fn=pod_l, w=208, h=208, seed=102, anchor=(-0.58, 0.16),
                  hp=400, states=("idle", "charge", "fire", "damaged", "destroyed")),
    "pod_r": dict(fn=pod_r, w=208, h=208, seed=103, anchor=(0.58, 0.16),
                  hp=400, states=("idle", "charge", "fire", "damaged", "destroyed")),
    "bay":   dict(fn=bay,   w=232, h=176, seed=104, anchor=(0.0, 0.25),
                  hp=600, states=("idle", "charge", "fire", "damaged", "destroyed")),
    "core":  dict(fn=core,  w=152, h=152, seed=105, anchor=(0.0, 0.25),
                  hp=900, states=("idle", "charge", "fire", "damaged", "destroyed")),
}
