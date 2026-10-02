"""Core drawing primitives for Spacerocker sprites.

Coordinate system: normalised (x, y) with x right, y down.
Ships face DOWN (towards the player): nose at +y, engines at -y.
Everything is drawn at SS x supersample then downsampled.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 4  # supersample factor

# ---------------------------------------------------------------- palettes

VOID = (5, 6, 13)
OUTLINE = (7, 9, 18)

# hull ramp: shadow / base / light / highlight
HULL = [(18, 22, 32), (40, 45, 60), (86, 95, 118), (156, 168, 196)]
# oxidised / damaged plating
RUST = [(42, 24, 20), (84, 50, 40), (128, 78, 60), (168, 112, 84)]
# dark interior / open bay
DARK = [(10, 12, 20), (16, 19, 30), (24, 28, 42), (34, 40, 58)]
# canopy glass
GLASS = [(14, 22, 34), (22, 38, 58), (38, 66, 96), (96, 140, 176)]

ACT_EMISSIVE = {
    # act 0 is not an act: it is the player/pickup palette, which never
    # changes act to act so the player stays findable in any biome.
    0: {"main": (0, 229, 255), "warn": (255, 46, 136), "core": (230, 245, 255)},
    1: {"main": (0, 229, 255), "warn": (255, 107, 26), "core": (150, 245, 255)},
    2: {"main": (157, 78, 221), "warn": (182, 255, 59), "core": (214, 170, 255)},
    3: {"main": (255, 107, 26), "warn": (255, 243, 196), "core": (255, 214, 150)},
}

MATERIALS = {"hull": HULL, "rust": RUST, "dark": DARK, "glass": GLASS}


def tone(material: str, level: int) -> tuple[int, int, int]:
    return MATERIALS[material][max(0, min(3, level))]


# ---------------------------------------------------------------- context


@dataclass
class Ctx:
    """Per-frame drawing parameters.

    ``size`` is the frame width in px; ``height`` defaults to a square frame.
    Normalised x spans [-1, 1] across the width; y uses the SAME unit, so the
    y range of a non-square frame is +/- height/width. Circles stay circular.
    """

    size: int
    height: int | None = None
    act: int = 1
    bank: float = 0.0              # -1 .. 1  roll
    bob: float = 0.0               # px offset, y
    glow: float = 1.0              # emissive intensity multiplier
    muzzle: float = 0.0            # 0 .. 1 muzzle flash
    charge: float = 0.0            # 0 .. 1 wind-up / bay door opening
    spin: float = 0.0              # radians, used by turret-likes
    scale: float = 1.0             # extra uniform scale
    seed: int = 0
    _albedo: Image.Image = field(init=False, default=None)
    _emissive: Image.Image = field(init=False, default=None)

    def __post_init__(self) -> None:
        if self.height is None:
            self.height = self.size
        w, h = self.size * SS, self.height * SS
        self._albedo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self._emissive = Image.new("RGB", (w, h), (0, 0, 0))
        self.da = ImageDraw.Draw(self._albedo, "RGBA")
        self.de = ImageDraw.Draw(self._emissive, "RGB")
        self.rng = np.random.default_rng(self.seed)

    # -- coordinate transform ------------------------------------------------

    def px(self, x: float, y: float) -> tuple[float, float]:
        hw = self.size * SS * 0.5
        hh = self.height * SS * 0.5
        xs = 1.0 - 0.22 * abs(self.bank)
        shear = 0.10 * self.bank
        x2 = (x * xs + shear * y) * self.scale
        y2 = y * self.scale * 0.94
        return (hw + x2 * hw * 0.94, hh + y2 * hw * 0.94 + self.bob * SS)

    def poly(self, pts):
        return [self.px(x, y) for x, y in pts]

    def emit_color(self, key: str = "main") -> tuple[int, int, int]:
        return ACT_EMISSIVE[self.act][key]


# ---------------------------------------------------------------- primitives


def plate(ctx: Ctx, pts, material="hull", level=1, alpha=255):
    c = tone(material, level)
    ctx.da.polygon(ctx.poly(pts), fill=(*c, alpha))


def line(ctx: Ctx, pts, material="hull", level=0, width=1.0, alpha=255):
    c = tone(material, level)
    ctx.da.line(ctx.poly(pts), fill=(*c, alpha), width=max(1, int(width * SS)),
                joint="curve")


def disc(ctx: Ctx, cx, cy, r, material="hull", level=1, alpha=255):
    c = tone(material, level)
    x0, y0 = ctx.px(cx - r, cy - r)
    x1, y1 = ctx.px(cx + r, cy + r)
    ctx.da.ellipse([x0, y0, x1, y1], fill=(*c, alpha))


def rivets(ctx: Ctx, pts, r=0.018, material="hull", level=0):
    for x, y in pts:
        disc(ctx, x, y, r, material, level)


def glow_poly(ctx: Ctx, pts, key="main", intensity=1.0):
    r, g, b = ctx.emit_color(key)
    i = max(0.0, min(2.2, intensity * ctx.glow))
    col = (min(255, int(r * i)), min(255, int(g * i)), min(255, int(b * i)))
    ctx.de.polygon(ctx.poly(pts), fill=col)


def glow_disc(ctx: Ctx, cx, cy, r, key="main", intensity=1.0):
    rr, gg, bb = ctx.emit_color(key)
    i = max(0.0, min(2.2, intensity * ctx.glow))
    col = (min(255, int(rr * i)), min(255, int(gg * i)), min(255, int(bb * i)))
    x0, y0 = ctx.px(cx - r, cy - r)
    x1, y1 = ctx.px(cx + r, cy + r)
    ctx.de.ellipse([x0, y0, x1, y1], fill=col)


def glow_line(ctx: Ctx, pts, key="main", intensity=1.0, width=1.0):
    rr, gg, bb = ctx.emit_color(key)
    i = max(0.0, min(2.2, intensity * ctx.glow))
    col = (min(255, int(rr * i)), min(255, int(gg * i)), min(255, int(bb * i)))
    ctx.de.line(ctx.poly(pts), fill=col, width=max(1, int(width * SS)),
                joint="curve")


def nozzle(ctx: Ctx, cx, cy, w, h, key="main", intensity=1.0):
    """Engine bell + exhaust flare. Exhaust points up (-y)."""
    plate(ctx, [(cx - w, cy), (cx + w, cy), (cx + w * 0.72, cy + h * 0.55),
                (cx - w * 0.72, cy + h * 0.55)], "hull", 0)
    glow_poly(ctx, [(cx - w * 0.78, cy + h * 0.10), (cx + w * 0.78, cy + h * 0.10),
                    (cx + w * 0.34, cy - h * 0.95 * intensity),
                    (cx - w * 0.34, cy - h * 0.95 * intensity)],
              "main", 0.95 * intensity)
    glow_poly(ctx, [(cx - w * 0.38, cy + h * 0.06), (cx + w * 0.38, cy + h * 0.06),
                    (cx + w * 0.16, cy - h * 1.25 * intensity),
                    (cx - w * 0.16, cy - h * 1.25 * intensity)],
              "core", 1.35 * intensity)


# ---------------------------------------------------------------- post


def _alpha_np(img: Image.Image) -> np.ndarray:
    return np.asarray(img.split()[-1], dtype=np.int16)


def bevel_and_outline(albedo: Image.Image) -> Image.Image:
    """Global top-light / bottom-shade bevel plus a dark readability outline."""
    arr = np.asarray(albedo, dtype=np.int16).copy()
    a = arr[..., 3]
    solid = a > 96

    band = max(1, int(SS * 1.6))
    top_edge = solid & ~np.roll(solid, band, axis=0)
    bot_edge = solid & ~np.roll(solid, -band, axis=0)
    left_edge = solid & ~np.roll(solid, band, axis=1)
    right_edge = solid & ~np.roll(solid, -band, axis=1)

    lit = top_edge | (left_edge & ~bot_edge)
    arr[..., :3][lit] = np.clip(arr[..., :3][lit] * 1.80 + 22, 0, 255)
    shade = bot_edge | (right_edge & ~top_edge)
    arr[..., :3][shade] = np.clip(arr[..., :3][shade] * 0.42, 0, 255)

    out = Image.fromarray(arr.astype(np.uint8), "RGBA")

    # dark outline underneath
    mask = albedo.split()[-1].filter(ImageFilter.MaxFilter(2 * SS + 1))
    shell = Image.new("RGBA", albedo.size, (*OUTLINE, 255))
    shell.putalpha(mask)
    return Image.alpha_composite(shell, out)


def finish(ctx: Ctx, halo=True) -> tuple[Image.Image, Image.Image]:
    """Downsample to final resolution and return (albedo RGBA, emissive RGB)."""
    alb = bevel_and_outline(ctx._albedo)
    emi = ctx._emissive
    if halo:
        emi = Image.blend(emi, emi.filter(ImageFilter.GaussianBlur(1.6 * SS)), 0.42)
        emi = Image.fromarray(
            np.clip(np.asarray(emi, np.int16) * 1.18, 0, 255).astype(np.uint8), "RGB")
    size = (ctx.size, ctx.height)
    return (alb.resize(size, Image.LANCZOS), emi.resize(size, Image.LANCZOS))


# ---------------------------------------------------------------- fx


def explosion(ctx: Ctx, t: float, spread=0.95, chunks=13):
    """t in 0..1. Fireball in emissive, smoke + debris in albedo."""
    rng = np.random.default_rng(ctx.seed + 991)

    if t < 0.62:
        r = 0.16 + spread * (t ** 0.55) * 1.05
        glow_disc(ctx, 0, 0, r, "warn", 1.5 * (1.0 - t / 0.62) ** 0.6)
        glow_disc(ctx, 0, 0, r * 0.58, "core", 1.9 * (1.0 - t / 0.62) ** 0.5)
    ring = 0.2 + spread * t * 1.5
    if 0.12 < t < 0.9:
        rr, gg, bb = ctx.emit_color("warn")
        f = (1.0 - abs(t - 0.45) / 0.5)
        col = tuple(min(255, int(c * 1.25 * max(0.0, f))) for c in (rr, gg, bb))
        x0, y0 = ctx.px(-ring, -ring)
        x1, y1 = ctx.px(ring, ring)
        ctx.de.ellipse([x0, y0, x1, y1], outline=col, width=max(1, int(2.4 * SS)))

    # smoke puffs
    for i in range(7):
        ang = rng.uniform(0, math.tau)
        d = (0.12 + 0.72 * t) * rng.uniform(0.35, 1.0)
        pr = (0.14 + 0.22 * t) * rng.uniform(0.6, 1.2)
        a = int(190 * max(0.0, 1.0 - t) ** 0.8)
        if a > 6:
            disc(ctx, math.cos(ang) * d, math.sin(ang) * d, pr, "dark",
                 1 if i % 2 else 2, alpha=a)

    # debris
    for i in range(chunks):
        ang = rng.uniform(0, math.tau)
        d = (0.1 + 1.25 * t) * rng.uniform(0.45, 1.0)
        s = rng.uniform(0.035, 0.085) * (1.0 - 0.35 * t)
        cx, cy = math.cos(ang) * d, math.sin(ang) * d
        rot = rng.uniform(0, math.tau) + t * 6
        pts = []
        for k in range(3):
            a2 = rot + k * math.tau / 3
            pts.append((cx + math.cos(a2) * s, cy + math.sin(a2) * s * 0.8))
        alpha = int(255 * max(0.0, 1.0 - (t - 0.35) / 0.65)) if t > 0.35 else 255
        if alpha > 8:
            plate(ctx, pts, "hull", 3 if i % 3 else 2, alpha=alpha)
            if i % 2 == 0:
                glow_disc(ctx, cx, cy, s * 0.55, "warn", 1.5 * (1 - t * 0.7))
