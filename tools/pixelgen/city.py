#!/usr/bin/env python3
"""Taproot City garden plots + fence kit (32px grid, Gen-3 style, original art).

Replaces the painted plot sprites and fence PNGs the city used to shrink and
stitch together at load time. Everything here is drawn at its exact in-game
size, so the game shows it 1:1:

  plot0..5          160x112  fenced 5x4-tile garden, gate gap in the middle tile
  fence_top/_bot    480x36   back / front run of a 15-tile farm plot (_bot has the gate gap)
  fence_h           32x36    one tile of front-facing fence (mega plots)
  fence_side        32x36    one tile of a fence running up the screen
  fence_arch_3/_4   116x86 / 148x86  gate arch over a 3- or 4-tile opening

    python3 tools/pixelgen/city.py      (or: python3 tools/pixelgen/build.py city)
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from interior import BRASS, METAL, h2  # noqa: E402
from pixel import Canvas, band, hx, light, mix, preview, ramp  # noqa: E402

OUT = Path(__file__).resolve().parent / "out" / "city"

WOOD = ramp("2e1c12", "4e3220", "74502e", "9a6e40", "bf9358", "dcb67a")  # fence timber, dark -> light
STONE = ramp("3a3642", "5a5662", "7a7684", "9c98a6", "bebac6")
SOIL = ramp("33200f", "4e3119", "6a4424", "865a32", "a2733f")
LEAF = ramp("16341e", "22502a", "34723a", "4f964a", "7cbc5e", "b4dc80")
GRASS = ramp("2e6a2c", "3f8a36", "58a844", "7cc458")
WHITE, INK = hx("fffcf2"), hx("1e1626")
FLOWERS = [hx("e8434a"), hx("f4c63c"), hx("f2f2f6"), hx("b46ae0"), hx("f08ab4"), hx("5aa0f0")]

FENCE_H = 36   # fence tiles are 32 wide; the ground line is 3px above the bottom
GROUND = FENCE_H - 3


def ellipse_in(x, y, cx, cy, rx, ry):
    return ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1


def blob(c, cx, cy, rx, ry, rmp, seed=0, wobble=0.15, dots=None):
    """Leafy clump lit from the top-left, with a bumpy edge and optional flower dots."""
    for y in range(int(cy - ry) - 2, int(cy + ry) + 3):
        for x in range(int(cx - rx) - 2, int(cx + rx) + 3):
            nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if nx * nx + ny * ny > (1 + wobble * math.sin(math.atan2(ny, nx) * 7 + seed)) ** 2:
                continue
            c.px(x, y, band(rmp, light(nx, ny) + (h2(x, y, seed) - 0.5) * 0.4))
            if dots and ny < 0.4 and h2(x, y, seed + 3) < 0.08:
                c.px(x, y, dots[int(h2(x, y, seed + 4) * len(dots))])


# ---------------------------------------------------------------- fence parts

def picket(c, x, top, ground):
    """One 4px picket with a pointed top and a dirt-darkened foot."""
    c.px(x + 1, top, WOOD[5]); c.px(x + 2, top, WOOD[4])
    for y in range(top + 1, ground + 1):
        foot = y > ground - 3
        c.px(x, y, WOOD[4] if not foot else WOOD[3])
        c.px(x + 1, y, WOOD[5] if y < top + 4 else WOOD[4] if not foot else WOOD[3])
        c.px(x + 2, y, WOOD[3] if not foot else WOOD[2])
        c.px(x + 3, y, WOOD[1])
    if (x // 6) % 3 == 1:  # a knot now and then
        c.px(x + 1, top + 9, WOOD[2])


def post(c, x, top, ground, w=6):
    """Square post with a capped top; lit on the left, shaded on the right."""
    for y in range(top + 3, ground + 1):
        for xx in range(x, x + w):
            k = xx - x
            col = WOOD[4] if k == 0 else WOOD[1] if k == w - 1 else WOOD[2] if k == w - 2 else WOOD[3]
            if y > ground - 3:
                col = mix(col, WOOD[0], 0.35)
            c.px(xx, y, col)
        if (y - top) % 9 == 5:  # grain
            c.px(x + 2, y, WOOD[2])
    for xx in range(x - 1, x + w + 1):  # cap
        c.px(xx, top + 1, WOOD[5] if xx < x + w - 1 else WOOD[3])
        c.px(xx, top + 2, WOOD[2] if xx > x else WOOD[3])
    for xx in range(x, x + w):
        c.px(xx, top, WOOD[4] if xx < x + w - 2 else WOOD[3])


def rails(c, x0, x1, ground):
    for x in range(x0, x1 + 1):
        for ry in (ground - 14, ground - 6):
            c.px(x, ry, WOOD[4]); c.px(x, ry + 1, WOOD[3]); c.px(x, ry + 2, WOOD[1])


def run(c, x0, x1, ground, posts):
    """Front-facing picket fence from x0 to x1 (inclusive) with posts at the given x's."""
    rails(c, x0, x1, ground)
    for x in range(x0, x1 - 2, 6):
        if any(p - 4 < x < p + 7 for p in posts):
            continue
        picket(c, x, ground - 18, ground)
    for p in posts:
        post(c, p, ground - 23, ground)


def side_run(c, x, y0, y1):
    """Fence running up the screen: pickets seen edge-on make one long strip, posts every tile."""
    for y in range(y0, y1 + 1):
        c.px(x, y, WOOD[5] if y % 6 else WOOD[4])
        c.px(x + 1, y, WOOD[4])
        c.px(x + 2, y, WOOD[2] if y % 6 else WOOD[1])
        c.px(x + 3, y, WOOD[1])


def tall_post(c, x, top, g):
    """Gate post: stone plinth, banded timber, cap and brass finial; 9px wide."""
    for y in range(g - 8, g + 1):
        for xx in range(x - 1, x + 10):
            row = (y - (g - 8)) // 3
            c.px(xx, y, STONE[4] if y == g - 8 else STONE[1] if y == g or (xx + row * 3) % 6 == 5 else STONE[3] if xx < x + 5 else STONE[2])
    for y in range(top + 8, g - 8):
        for xx in range(x, x + 9):
            k = xx - x
            col = WOOD[5] if k == 0 else WOOD[4] if k < 3 else WOOD[1] if k == 8 else WOOD[2] if k == 7 else WOOD[3]
            if (y - top) % 11 == 0 and 0 < k < 8:
                col = WOOD[2]
            c.px(xx, y, col)
    for y, (a, b) in ((top + 7, (-1, 10)), (top + 6, (-1, 10)), (top + 5, (0, 9))):
        for xx in range(x + a, x + b):
            c.px(xx, y, WOOD[5] if y == top + 5 else WOOD[3] if y == top + 6 else WOOD[1])
    for y in range(top, top + 5):
        for xx in range(x + 2, x + 7):
            if ellipse_in(xx, y, x + 4.5, top + 2.5, 2.6, 2.6):
                c.px(xx, y, BRASS[3] if xx + y < x + top + 6 else BRASS[2] if xx < x + 6 else BRASS[1])


def gate_arch(gap):
    """Entrance over a farm gate: posts either side of a `gap`-px opening, a crossbeam
    high enough to walk under, and a hanging sign with a sprout on it."""
    w = gap + 20
    c = Canvas(w, 86)
    g = 83
    l, r = 1, w - 11
    beam = 14
    for x in range(1, w - 1):  # crossbeam with end overhangs
        for k, col in enumerate((WOOD[5], WOOD[4], WOOD[3], WOOD[3], WOOD[2], WOOD[1])):
            c.px(x, beam + k, col)
        if x % 16 == 7:
            c.px(x, beam + 2, METAL[1]); c.px(x, beam + 3, METAL[0])
    tall_post(c, l, 6, g)
    tall_post(c, r, 6, g)
    for side, x0 in ((1, l + 9), (-1, r - 1)):  # corner braces
        for k in range(8):
            c.px(x0 + side * k, beam + 13 - k, WOOD[3]); c.px(x0 + side * k, beam + 14 - k, WOOD[1])
    cx = w // 2
    for y in range(beam + 6, beam + 11):  # chains
        c.px(cx - 13, y, METAL[2] if y % 2 else METAL[1]); c.px(cx + 12, y, METAL[2] if y % 2 else METAL[1])
    for y in range(beam + 11, beam + 25):  # sign board
        for x in range(cx - 17, cx + 17):
            col = WOOD[5] if y == beam + 11 else WOOD[1] if y == beam + 24 or x in (cx - 17, cx + 16) else WOOD[4] if (y - beam) % 4 == 3 else WOOD[3]
            c.px(x, y, col)
    sprout = ["...bb.bb...", "..bccbccb..", "...bbcbb...", ".....a.....", ".....a.....", "..ddddddd..", "...ddddd..."]
    pal = {"a": LEAF[2], "b": LEAF[3], "c": LEAF[5], "d": SOIL[2]}
    for j, row in enumerate(sprout):
        for i, ch in enumerate(row):
            if ch != ".":
                c.px(cx - 5 + i, beam + 14 + j, pal[ch])
    c.outline()
    return c


# ------------------------------------------------------------------- crops

def crop(c, kind, x, y, seed):
    """One plant whose base sits on (x, y)."""
    if kind == "cabbage":
        blob(c, x, y - 3, 5, 4, ramp("1e4a26", "3a7a3a", "6aac52", "a6d878", "d4eeb0"), seed, 0.25)
        c.px(x, y - 4, hx("d4eeb0")); c.px(x - 1, y - 3, hx("a6d878"))
    elif kind == "wheat":
        for k in range(-3, 4, 2):
            h = 11 + int(h2(x + k, y, seed) * 4)
            for j in range(h):
                c.px(x + k, y - j, hx("b08a2a") if j < h - 4 else hx("e8c050"))
            for j in range(h - 4, h):
                c.px(x + k + (j % 2 * 2 - 1), y - j, hx("f4d878"))
            c.px(x + k, y - h, hx("fae6a0"))
    elif kind == "pumpkin":
        P = ramp("7a3008", "b85a10", "e8862a", "ffb85a")
        for yy in range(y - 8, y + 1):
            for xx in range(x - 6, x + 6):
                if ellipse_in(xx, yy, x, y - 3.5, 6, 4.4):
                    col = band(P, light((xx + 0.5 - x) / 6, (yy + 0.5 - y + 3.5) / 4.4))
                    if (xx - x) in (-3, 0, 3):
                        col = mix(col, P[0], 0.45)
                    c.px(xx, yy, col)
        c.px(x, y - 8, LEAF[1]); c.px(x, y - 9, LEAF[2]); c.px(x + 1, y - 10, LEAF[3])
        blob(c, x - 7, y - 2, 3, 2, LEAF, seed)
    elif kind == "sunflower":
        for j in range(18):
            c.px(x, y - j, LEAF[2]); c.px(x + 1, y - j, LEAF[1])
        for lx, ly in ((-3, 6), (3, 10)):
            blob(c, x + lx, y - ly, 2.5, 1.6, LEAF, seed + lx)
        for yy in range(y - 26, y - 16):
            for xx in range(x - 5, x + 6):
                if ellipse_in(xx, yy, x + 0.5, y - 21, 5, 5):
                    inner = ellipse_in(xx, yy, x + 0.5, y - 21, 2.5, 2.5)
                    c.px(xx, yy, (hx("5a3214") if xx + yy < x + y - 21 else hx("3a1e0e")) if inner else
                         (hx("ffe070") if xx + yy < x + y - 20 else hx("f0b020")))
    elif kind == "carrot":
        for k in (-2, 0, 2):
            for j in range(5):
                c.px(x + k + (j % 2) * (1 if k > 0 else -1 if k < 0 else 0), y - 2 - j, LEAF[3] if j < 3 else LEAF[4])
        for xx in range(x - 2, x + 3):
            c.px(xx, y - 1, hx("e87a2a")); c.px(xx, y, hx("c45a14"))
    else:  # tomatoes on a stake
        for j in range(20):
            c.px(x, y - j, WOOD[3]); c.px(x + 1, y - j, WOOD[1])
        blob(c, x, y - 10, 5, 8, LEAF, seed, 0.3)
        for tx, ty in ((-3, 6), (2, 9), (-1, 13), (3, 15), (-3, 16)):
            c.px(x + tx, y - ty, hx("e8343a")); c.px(x + tx + 1, y - ty, hx("b0222a")); c.px(x + tx, y - ty - 1, hx("ff8a7a"))


PLOT_CROPS = ["cabbage", "wheat", "pumpkin", "sunflower", "carrot", "tomato"]


def plot(i):
    """Fenced garden on a 5x4-tile lot. Sprite bottom = lot bottom; back fence on
    row 1, side fences on columns 0 and 4, front fence on row 3 with the gate gap
    in the middle tile (x 64..95)."""
    c = Canvas(160, 112)
    back, front = 46, 109           # ground lines of the back and front fences
    # tilled bed: furrows run across, darker in the troughs, damp edge along the fence
    for y in range(back + 1, front - 4):
        for x in range(20, 141):
            r = (y - back - 1) % 7
            col = SOIL[3] if r == 0 else SOIL[2] if r < 3 else SOIL[1] if r < 6 else SOIL[0]
            if h2(x, y, i) < 0.05:
                col = SOIL[4] if r < 3 else SOIL[0]
            c.px(x, y, col)
    for y in range(back + 1, front - 4):
        for x in (20, 21, 139, 140):
            c.px(x, y, mix(c.get(x, y), SOIL[0], 0.4))
    for x in range(20, 141):  # grass fringe tucked under the back fence
        for k in range(3):
            if h2(x, k, i + 5) < 0.75 - k * 0.25:
                c.px(x, back + 1 + k, GRASS[2 - k // 2] if k else GRASS[3])
    kind = PLOT_CROPS[i % len(PLOT_CROPS)]
    rows = [back + 14, back + 27, back + 40] if kind not in ("sunflower", "tomato") else [back + 25, back + 42]
    step = 14 if kind in ("pumpkin", "sunflower", "tomato") else 10
    for r, ry in enumerate(rows):
        for x in range(30 + (r % 2) * step // 2, 134, step):
            if h2(x, ry, i) < 0.08:
                continue
            crop(c, kind, x, ry, i * 31 + x)
    # fences: back run with corner posts, sides, front with the gate gap
    run(c, 11, 148, back, [13, 45, 77, 109, 141])
    side_run(c, 14, back - 6, front - 2)
    side_run(c, 142, back - 6, front - 2)
    for y in range(back + 26, front - 6, 32):  # mid posts on the side runs
        post(c, 13, y - 23, y)
        post(c, 141, y - 23, y)
    run(c, 11, 63, front, [13, 45])
    run(c, 96, 148, front, [109, 141])
    for gx in (57, 96):  # gate posts either side of the opening
        for y in range(front - 28, front + 1):
            for x in range(gx, gx + 7):
                k = x - gx
                c.px(x, y, WOOD[5] if k == 0 else WOOD[1] if k == 6 else WOOD[2] if k == 5 else WOOD[3])
        for x in range(gx - 1, gx + 8):
            c.px(x, front - 29, WOOD[5]); c.px(x, front - 28, WOOD[2])
        for y in range(front - 33, front - 29):
            for x in range(gx + 2, gx + 5):
                c.px(x, y, BRASS[3] if x == gx + 2 else BRASS[2])
    if i % 3 == 1:  # a scarecrow keeps watch
        sx, sy = 118, back + 40
        for y in range(sy - 30, sy + 1):
            c.px(sx, y, WOOD[3]); c.px(sx + 1, y, WOOD[1])
        for x in range(sx - 9, sx + 11):
            c.px(x, sy - 22, WOOD[3]); c.px(x, sy - 21, WOOD[1])
        for y in range(sy - 23, sy - 12):
            for x in range(sx - 5, sx + 7):
                c.px(x, y, hx("5a7ad8") if x < sx + 4 else hx("3a56a8"))
        for x in range(sx - 4, sx + 6):
            c.px(x, sy - 13, hx("c8962a"))
        for y in range(sy - 30, sy - 23):
            for x in range(sx - 3, sx + 5):
                c.px(x, y, hx("ecd08a") if x < sx + 3 else hx("c8a860"))
        c.px(sx - 1, sy - 27, INK); c.px(sx + 2, sy - 27, INK)
        for x in range(sx - 7, sx + 9):
            c.px(x, sy - 31, hx("b07a2a"))
        for y in range(sy - 35, sy - 31):
            for x in range(sx - 3, sx + 5):
                c.px(x, y, hx("d8a440") if x < sx + 3 else hx("b07a2a"))
    elif i % 3 == 2:  # watering can by the gate
        wx, wy = 40, front - 12
        for y in range(wy - 6, wy + 1):
            for x in range(wx, wx + 9):
                c.px(x, y, METAL[3] if x < wx + 3 else METAL[2] if x < wx + 7 else METAL[1])
        for k in range(5):
            c.px(wx + 9 + k, wy - 3 - k, METAL[2])
        for x in range(wx + 2, wx + 7):
            c.px(x, wy - 9, METAL[1])
        c.px(wx + 1, wy - 8, METAL[1]); c.px(wx + 7, wy - 8, METAL[1])
    c.outline()
    return c


# ---------------------------------------------------------------- fence kit

def fence_kit():
    out = {}
    for name, gap in (("fence_top", None), ("fence_bot", (192, 288))):
        c = Canvas(480, FENCE_H)
        spans = [(1, 478)] if gap is None else [(1, gap[0] - 1), (gap[1], 478)]
        for a, b in spans:
            posts = [p for p in range(13, 480, 32) if a <= p and p + 6 <= b + 1]
            run(c, a, b, GROUND, posts + ([2] if a == 1 else []) + ([472] if b == 478 else []))
        c.outline()
        out[name] = c
    c = Canvas(32, FENCE_H)
    run(c, 0, 31, GROUND, [13])
    c.outline()
    out["fence_h"] = c
    c = Canvas(32, FENCE_H)
    side_run(c, 14, 0, GROUND)
    post(c, 13, GROUND - 23, GROUND)
    c.outline()
    out["fence_side"] = c
    out["fence_arch_3"] = gate_arch(96)
    out["fence_arch_4"] = gate_arch(128)
    return out


# ------------------------------------------------------------------ output

def build():
    out = {f"plot{i}": plot(i) for i in range(len(PLOT_CROPS))}
    out.update(fence_kit())
    return {k: v.image() for k, v in out.items()}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    imgs = build()
    for k, im in imgs.items():
        im.save(OUT / f"{k}.png")
    preview([(k, [imgs[k]]) for k in imgs if k.startswith("plot")], scale=3, max_w=520).save(OUT / "plots_preview.png")
    preview([(k, [imgs[k]]) for k in imgs if k.startswith("fence") and k not in ("fence_top", "fence_bot")], scale=4, max_w=360).save(OUT / "fence_preview.png")
    print("wrote", len(imgs), "sprites + 2 previews to", OUT)


if __name__ == "__main__":
    main()
