#!/usr/bin/env python3
"""Textures + billboard sprites for the Three.js city (HD-2D style).

Tileable textures at 16px per world unit (32px for the timber wall, which spans
2 units) go on real 3D geometry; billboard sprites (trees, lamps, stalls, props,
NPCs) stand in the world facing the camera. Writes out/city3d.

    python3 tools/pixelgen/city3d.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from interior import DW, PLASTER, STONE, h2, merchant  # noqa: E402
from market import bakery_stall, barrel, crate, fruit_stall, potion_stall, sack  # noqa: E402
from pixel import Canvas, blob, hx, mix, poly, preview, ramp, rect  # noqa: E402

OUT = Path(__file__).resolve().parent / "out" / "city3d"

COB = ramp("4a4652", "6a6672", "8a8694", "aaa6b4", "c8c4d0")
GRASS = ramp("2e6e2a", "3e8a34", "52a640", "78c45a")
DIRT = ramp("8a6a42", "a8865a", "c4a272", "dcc090")
SLATE = ramp("23304e", "34497a", "4a66a0", "7290c8")
CLAY = ramp("6a1e16", "9a3420", "c4502e", "e07a4a")
LEAF = ramp("1c4a22", "2c6e30", "449a3c", "74c056", "a8e07a")
PINE = ramp("123a26", "1e5634", "2e7a42", "4a9a56")
WATER = ramp("2a7aa8", "3e9cc8", "62bce0", "a8e2f6")


def tile(w, h, fn):
    c = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            c.px(x, y, fn(x, y))
    return c


def wrapped_blob(c, cx, cy, rx, ry, rmp):
    for ox in (-c.w, 0, c.w):
        for oy in (-c.h, 0, c.h):
            blob(c, cx + ox, cy + oy, rx, ry, rmp)


# ---------------------------------------------------------------- textures

def cobble():
    c = tile(16, 16, lambda x, y: hx("3a3640"))
    for cx, cy in ((4, 4), (12, 4.5), (0, 12), (8, 12.5), (16, 12)):
        wrapped_blob(c, cx, cy, 3.6, 3.2, COB[1:])
    return c


def grass():
    def px(x, y):
        r = h2(x, y, 61)
        return GRASS[1] if r < 0.18 else GRASS[3] if r > 0.9 else GRASS[2]
    c = tile(16, 16, px)
    for x, y in ((2, 5), (9, 2), (13, 10), (5, 13), (11, 6)):
        c.px(x, y, GRASS[0]); c.px(x, y - 1, GRASS[1]); c.px(x + 1, y - 1, GRASS[3])
    return c


def dirt():
    def px(x, y):
        r = h2(x, y, 71)
        return DIRT[1] if r < 0.12 else DIRT[3] if r > 0.94 else DIRT[2]
    c = tile(16, 16, px)
    for x, y in ((3, 4), (11, 9), (6, 13)):
        c.px(x, y, DIRT[0]); c.px(x + 1, y, DIRT[3])
    return c


def plaster_timber():
    """32x32 = two wall units: a timber frame with one braced panel."""
    def px(x, y):
        r = h2(x, y, 81)
        return PLASTER[1] if r < 0.06 else PLASTER[3] if r > 0.95 else PLASTER[2]
    c = tile(32, 32, px)
    for y in range(32):
        for x in (0, 1, 16, 17):
            c.px(x, y, DW[3] if x in (0, 16) else DW[1])
    for x in range(32):
        for y, col in ((0, DW[4]), (1, DW[2]), (30, DW[3]), (31, DW[1])):
            c.px(x, y, col)
    for i in range(28):  # diagonal brace in the first panel
        x, y = 2 + round(i * 13 / 27), 29 - i
        c.px(x, y, DW[3]); c.px(x + 1, y, DW[1])
    return c


def stone_wall():
    def px(x, y):
        bx, by = (x + ((y // 4) % 2) * 4) % 8, y % 4
        if by == 3 or bx == 7:
            return hx("3a3640")
        return STONE[3] if (by == 0 or bx == 0) else STONE[2] if h2(x, y, 9) > 0.1 else STONE[1]
    return tile(16, 16, px)


def shingles(rmp):
    def px(x, y):
        row = y // 4
        if y % 4 == 3:
            return rmp[0]
        if (x + (row % 2) * 4) % 8 == 0:
            return rmp[1]
        return rmp[3] if y % 4 == 0 else rmp[2]
    return tile(16, 16, px)


def door():
    c = Canvas(16, 24)
    rect(c, 0, 0, 16, 24, DW[0])
    for y in range(2, 24):
        for x in range(2, 14):
            if y < 4 and not 4 <= x <= 11:
                continue
            k = (x - 2) % 4
            c.px(x, y, DW[1] if k == 3 else DW[4] if k == 0 else DW[3])
    for y in (7, 17):
        rect(c, 2, y, 12, 1, hx("3a3a44"))
    rect(c, 11, 13, 2, 2, hx("e0b450"))
    return c


def window():
    c = Canvas(16, 16)
    rect(c, 1, 1, 14, 13, DW[1])
    for y in range(3, 12):
        for x in range(3, 13):
            c.px(x, y, hx("ffe08a") if y < 7 else hx("f0b850"))
    rect(c, 7, 3, 2, 9, DW[1]); rect(c, 3, 7, 10, 1, DW[1])
    c.px(4, 4, hx("fff6d0"))
    rect(c, 0, 13, 16, 2, DW[4]); rect(c, 0, 15, 16, 1, DW[2])
    return c


def water():
    def px(x, y):
        col = WATER[1] if h2(x, y, 91) > 0.15 else WATER[0]
        for wx, wy, ln in ((2, 3, 4), (9, 8, 5), (4, 13, 3)):
            if y == wy and 0 <= (x - wx) % 16 < ln:
                col = WATER[3] if (x - wx) % 16 == ln // 2 else WATER[2]
        return col
    return tile(16, 16, px)


# -------------------------------------------------------------- billboards

def oak():
    c = Canvas(40, 50)
    for y in range(30, 47):
        for x in range(17, 23):
            c.px(x, y, DW[4] if x == 17 else DW[1] if x >= 21 else DW[3])
    for x, y in ((15, 46), (16, 45), (23, 45), (24, 46)):
        c.px(x, y, DW[2])
    for cx, cy, rx, ry in ((20, 22, 15, 11), (11, 18, 8, 7), (29, 18, 8, 7), (20, 10, 10, 8), (14, 27, 7, 5), (27, 27, 7, 5)):
        blob(c, cx, cy, rx, ry, LEAF, dither=True)
    for x, y in ((14, 14), (25, 12), (20, 20), (12, 22), (28, 22)):
        c.px(x, y, LEAF[1])
    c.outline()
    c.shadows.append((20, 47.5, 9, 1.8, 90))
    return c


def pine():
    c = Canvas(30, 52)
    for y in range(40, 49):
        for x in range(13, 17):
            c.px(x, y, DW[3] if x == 13 else DW[1])
    for top, half, base in ((2, 6, 16), (10, 9, 26), (19, 12, 36), (28, 14, 44)):
        poly(c, [(15, top), (15 + half, base), (15 - half, base)], PINE[2])
        for y in range(top, base + 1):
            for x in range(1, 30):
                if c.get(x, y) == PINE[2]:
                    t = (x - (15 - half)) / (2 * half)
                    c.px(x, y, PINE[3] if t < 0.3 else PINE[1] if t > 0.75 else PINE[2])
        for x in range(15 - half + 1, 15 + half):
            if c.get(x, base):
                c.px(x, base, PINE[0])
    c.outline()
    c.shadows.append((15, 49.5, 7, 1.6, 90))
    return c


def lamp():
    c = Canvas(14, 42)
    for y in range(12, 39):
        c.px(6, y, hx("4a4a5a")); c.px(7, y, hx("2a2a36"))
    rect(c, 4, 38, 6, 2, hx("3a3a48"))
    rect(c, 3, 3, 8, 8, hx("2a2a36"))
    rect(c, 4, 4, 6, 6, hx("ffd664")); rect(c, 5, 5, 2, 2, hx("fff6c8"))
    rect(c, 2, 2, 10, 1, hx("3a3a48")); c.px(6, 1, hx("3a3a48")); c.px(7, 1, hx("3a3a48"))
    c.outline()
    return c


def bush():
    c = Canvas(22, 16)
    for cx, cy, rx, ry in ((11, 9, 9, 5.5), (6, 8, 5, 4), (16, 8, 5, 4)):
        blob(c, cx, cy, rx, ry, LEAF)
    for x, y, col in ((7, 6, "f48fb1"), (14, 7, "ffd54a"), (11, 5, "ffffff"), (17, 10, "f48fb1")):
        c.px(x, y, hx(col))
    c.outline()
    return c


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    textures = {"tex_cobble": cobble(), "tex_grass": grass(), "tex_dirt": dirt(), "tex_plaster": plaster_timber(),
                "tex_stone": stone_wall(), "tex_slate": shingles(SLATE), "tex_clay": shingles(CLAY),
                "tex_door": door(), "tex_window": window(), "tex_water": water()}
    billboards = {"oak": oak, "pine": pine, "lamp": lamp, "bush": bush, "fruit_stall": fruit_stall, "potion_stall": potion_stall,
                  "bakery_stall": bakery_stall, "barrel": barrel, "crate": crate, "sack": sack, "merchant": merchant}
    images = {k: v.image() for k, v in textures.items()}
    for k, make in billboards.items():
        c = make()
        if k not in ("oak", "pine", "lamp", "bush", "merchant"):
            c.outline()
        images[k] = c.image()
    for k, im in images.items():
        im.save(OUT / f"{k}.png")
    preview([(k.replace("tex_", ""), [images[k]]) for k in textures], scale=6, max_w=160, bg="checker").save(OUT / "textures_preview.png")
    preview([(k.replace("_", " "), [images[k]]) for k in billboards], scale=4, max_w=260, bg="checker").save(OUT / "billboards_preview.png")
    print("wrote", len(images), "city3d images + 2 previews to", OUT)


if __name__ == "__main__":
    main()
