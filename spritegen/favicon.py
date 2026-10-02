"""Favicon, drawn by the same pipeline as everything else.

No external asset: it renders the player ship through `player.player` at a
large size, composites the emissive the way the engine does, frames it on the
void, and writes the icon sizes a browser asks for.

The ship is a thin arrowhead, so at 16px it needs help: the art is cropped to
its own bounding box and given a rounded void plate plus a magenta bloom, or it
dissolves into three grey pixels in a tab strip.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from .anim import render_frame
from .player import player as player_draw

# Large enough that the downsample to 16px stays clean.
MASTER = 512
ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64)]
APPLE = 180

VOID = (5, 6, 13)
SIGNAL = (255, 46, 136)


def _ship(size: int) -> Image.Image:
    """The player, composited albedo + emissive, cropped to its own art."""
    alb, emi = render_frame(player_draw, size, size, 0, 99, "idle", 0, False,
                            gun=(0.0, -0.90))
    out = Image.new("RGBA", alb.size, (0, 0, 0, 0))
    out.alpha_composite(alb)

    # the engine adds the emissive on top; do the same so the neon reads
    px_o = out.load()
    px_e = emi.convert("RGB").load()
    for y in range(out.size[1]):
        for x in range(out.size[0]):
            r, g, b, a = px_o[x, y]
            er, eg, eb = px_e[x, y]
            if er or eg or eb:
                px_o[x, y] = (min(255, r + er), min(255, g + eg),
                              min(255, b + eb), max(a, max(er, eg, eb)))

    bbox = out.getbbox()
    return out.crop(bbox) if bbox else out


def _plate(size: int) -> Image.Image:
    """Rounded void tile, so the icon has mass in a tab strip."""
    plate = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(plate)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.18),
                        fill=(*VOID, 255))
    return plate


def _compose(master: int = MASTER) -> Image.Image:
    ship = _ship(master)

    # fit the ship into the plate with a margin, keeping its aspect
    # fills most of the tile: at 16px a polite margin just turns the ship
    # into three grey pixels
    inner = int(master * 0.9)
    scale = min(inner / ship.size[0], inner / ship.size[1])
    ship = ship.resize((max(1, int(ship.size[0] * scale)),
                        max(1, int(ship.size[1] * scale))), Image.LANCZOS)

    icon = _plate(master)

    # magenta bloom behind the hull, so the silhouette separates from the void
    glow = Image.new("RGBA", (master, master), (0, 0, 0, 0))
    gx = (master - ship.size[0]) // 2
    gy = (master - ship.size[1]) // 2
    glow.alpha_composite(ship, (gx, gy))
    # tight bloom: a wide one smears the silhouette away at small sizes
    glow = glow.filter(ImageFilter.GaussianBlur(master * 0.022))
    tint = Image.new("RGBA", (master, master), (*SIGNAL, 0))
    tint.putalpha(glow.split()[-1].point(lambda v: int(v * 0.55)))
    icon.alpha_composite(tint)

    icon.alpha_composite(ship, (gx, gy))
    # clip the bloom back to the plate corners
    icon.putalpha(Image.composite(icon.split()[-1],
                                  Image.new("L", (master, master), 0),
                                  _plate(master).split()[-1]))
    return icon


def write(out_dir: Path) -> list[str]:
    """Write favicon.ico and apple-touch-icon.png. Returns the names."""
    out_dir.mkdir(parents=True, exist_ok=True)
    icon = _compose()

    ico = out_dir / "favicon.ico"
    icon.resize((64, 64), Image.LANCZOS).save(ico, format="ICO", sizes=ICO_SIZES)

    png = out_dir / "favicon-32.png"
    icon.resize((32, 32), Image.LANCZOS).save(png, optimize=True)

    apple = out_dir / "apple-touch-icon.png"
    # iOS composites onto its own background, so flatten the corners away
    flat = Image.new("RGB", (MASTER, MASTER), VOID)
    flat.paste(icon, (0, 0), icon)
    flat.resize((APPLE, APPLE), Image.LANCZOS).save(apple, optimize=True)

    return [ico.name, png.name, apple.name]
