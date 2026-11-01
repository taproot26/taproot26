#!/usr/bin/env python3
"""Cave / mine tileset (Gen-3 style, original art).

16x16 tiles: two floors, a floor with the wall's shadow, the rock mass seen
from above, a 2-tile cliff face, rock lips and corners (all from one depth
field so neighbours line up), an underground pool (2 frames) with its rims,
and mine-track overlays. Props: stalagmites, stalactite, blue / purple
crystals, glowing mushrooms, gold / iron / crystal ore nodes, boulders,
minecart, mine support beam, cave entrance (for the overworld), wall torch
(2 frames), bones, cobweb, ladder hole, puddle, pickaxe. Writes PNGs to
out/cave plus a tile sheet, a prop sheet and a sample lit cave.

    python3 tools/pixelgen/cave.py
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from coast import chest  # noqa: E402
from interior import METAL, h2  # noqa: E402
from market import barrel, crate  # noqa: E402
from pixel import Canvas, band, blob, hx, light, line, mix, poly, preview, ramp, rect  # noqa: E402

OUT = Path(__file__).resolve().parent / "out" / "cave"
T = 16

ROCK = ramp("1a1320", "2e2230", "45333c", "5f4848", "7c6058", "9e7e6c")
FLOOR = ramp("2c2226", "3e3030", "52403a", "665044", "7c6450")
WATER = ramp("0c1630", "12264c", "1c3c6c", "2a5a90", "5a96c4", "b4e4f4")
BLUE = ramp("16246a", "2440a8", "3672dc", "64aef8", "b4e6ff", "ffffff")
PURPLE = ramp("2e1058", "52209a", "7a36cc", "a868ee", "dcaeff", "ffffff")
SHROOM = ramp("0c4252", "16707e", "24aab4", "64ece2", "ccfff6")
GOLD = ramp("6e4210", "ac7a1c", "e8b83a", "fff09a")
IRON = ramp("4a2a20", "7a4630", "b06c4a", "e0a07c")
WOOD = ramp("2e1c12", "4a2e1a", "6a4426", "8c5c34", "ae7a48")
FLAME = ramp("b0281a", "f06a1c", "ffb030", "fff2a0")
BONE = ramp("6e6658", "a8a08a", "d8d2bc", "f6f2e4")
DARK = hx("0c0810")


def tile(fn):
    c = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            c.px(x, y, fn(x, y))
    return c


def wob(t, s=0):
    return round(math.sin((t + s) / 16 * 2 * math.pi) * 1.2)


# -------------------------------------------------------------- pixel fields

def floor_px(x, y, v=0):
    x, y = x % 16, y % 16
    r = h2(x, y, 61 + v)
    col = FLOOR[2] if r < 0.55 else FLOOR[3] if r < 0.93 else FLOOR[1]
    pebbles = ((3, 4), (11, 10), (6, 13)) if v == 0 else ((12, 3), (4, 9), (9, 14), (14, 12))
    for px, py in pebbles:  # lit top-left, shadow under
        if (x, y) == (px, py):
            return FLOOR[4]
        if (x, y) in ((px + 1, py), (px, py + 1)):
            return FLOOR[3]
        if (x, y) in ((px + 1, py + 1), (px, py + 2), (px + 1, py + 2)):
            return FLOOR[1]
    if v == 1 and (x, y) in ((2, 2), (3, 3), (4, 3), (5, 4), (13, 6), (13, 7), (12, 8)):
        return FLOOR[0]  # hairline cracks
    return col


LUMPS = [(3, 3, 4.5), (11, 2, 4.5), (7, 9, 5), (15, 10, 4.5), (2, 14, 4), (11, 15, 4)]


def rock_px(x, y):
    """Rock mass from above: tileable lumpy boulders lit from the top-left,
    split by dark crevices where two lumps meet."""
    x, y = x % 16, y % 16
    best = []
    for cx, cy, r in LUMPS:
        for ox in (-16, 0, 16):
            for oy in (-16, 0, 16):
                dx, dy = x + 0.5 - (cx + ox), y + 0.5 - (cy + oy)
                best.append((math.hypot(dx, dy) / r, dx / r, dy / r))
    best.sort()
    d0, nx, ny = best[0]
    if best[1][0] - d0 < 0.12:
        return ROCK[0]
    l = light(nx, ny) * 0.9 - d0 * 0.25
    if h2(x, y, 71) < 0.07:
        l -= 0.3
    return band(ROCK[1:5], l)


def face_px(x, y):
    """Cliff face, 32 px tall (two tiles): bright lip, vertical rock ribs that
    darken toward the floor, a crevice at the foot."""
    x = x % 16
    if y == 0:
        return ROCK[5] if x % 5 else ROCK[4]
    if y == 1:
        return ROCK[4]
    if y >= 30:
        return DARK if y == 31 or (x + y) % 3 else ROCK[0]
    edges = (0, 4, 7, 12)  # rib boundaries
    k = max(i for i, e in enumerate(edges) if e <= x)
    x0 = edges[k]
    x1 = (edges + (16,))[k + 1] - 1
    if x == x1:
        return ROCK[0] if (y + k) % 7 else ROCK[1]
    t = (x - x0) / max(1, x1 - x0)
    l = 0.55 - t * 0.9 - (y / 30) * 0.9
    if (y + k * 5) % 9 == 0:
        l -= 0.5  # horizontal fracture
    elif (y + k * 5) % 9 == 1:
        l += 0.25
    return band(ROCK[1:6], l)


def shadow_floor_px(x, y, v=0):
    col = floor_px(x, y, v)
    if y < 4:
        return mix(col, DARK, 0.55 - y * 0.12)
    return col


def water_px(x, y, f=0):
    x, y = x % 16, y % 16
    r = h2(x // 2, y // 2, 81)
    col = WATER[2] if r > 0.78 else WATER[1] if r > 0.08 else WATER[0]
    for wx, wy, ln in ((1, 3, 6), (9, 6, 5), (4, 10, 6), (12, 13, 4)):
        dx = (x - wx - f) % 16
        if y == wy and dx < ln:
            col = WATER[4] if dx == ln // 2 else WATER[3]
        elif y == wy + 1 and 0 < dx < ln - 1:
            col = WATER[0]
    if (x, y) == ((13 + f * 2) % 16, 1):
        col = WATER[5]
    return col


# Signed depth into the "other" material for each side (positive = other).
EDGE = {
    "s": lambda x, y: y - (10 + wob(x)),
    "n": lambda x, y: (5 - wob(x, 4)) - y,
    "e": lambda x, y: x - (10 + wob(y, 2)),
    "w": lambda x, y: (5 - wob(y, 6)) - x,
}


def lip(depth):
    """Floor with rock on a side: rock top, a bright 1px rim, dark crevice."""
    def px(x, y):
        d = depth(x, y)
        if d >= 1:
            return rock_px(x, y)
        if d >= 0:
            return ROCK[4]
        if d >= -1:
            return DARK
        if d >= -2:
            return FLOOR[1]
        return floor_px(x, y)
    return tile(px)


def pool(depth, f=0):
    """Floor with water on a side: stone rim, then dark water."""
    def px(x, y):
        d = depth(x, y)
        if d >= 2:
            return water_px(x, y, f)
        if d >= 1:
            return WATER[0]
        if d >= 0:
            return FLOOR[4] if (x + y) % 4 else FLOOR[3]
        if d >= -1:
            return FLOOR[1]
        return floor_px(x, y)
    return tile(px)


def face_tiles():
    """wall_hi / wall_lo stack under rock tops. The _w / _e versions end the
    face against a side wall (rock creeping in from that side)."""
    out = {}
    for name, oy in (("wall_hi", 0), ("wall_lo", 16)):
        out[name] = tile(lambda x, y, oy=oy: face_px(x, y + oy))
        for side in ("w", "e"):
            def px(x, y, oy=oy, side=side):
                d = EDGE[side](x, y)
                if d >= 1:
                    return rock_px(x, y)
                if d >= 0:
                    return ROCK[4]
                if d >= -1:
                    return ROCK[0]
                return face_px(x, y + oy)
            out[f"{name}_{side}"] = tile(px)
    return out


def edge_tiles():
    out = {}
    for k in ("s", "e", "w"):
        out[f"lip_{k}"] = lip(EDGE[k])
    for a, b in (("s", "e"), ("s", "w")):
        out[f"lip_{a}{b}"] = lip(lambda x, y, a=a, b=b: max(EDGE[a](x, y), EDGE[b](x, y)))  # inner corner
        out[f"lip_{a}{b}_out"] = lip(lambda x, y, a=a, b=b: min(EDGE[a](x, y), EDGE[b](x, y)))  # outer corner
    for f in (0, 1):
        out[f"pool_{f}"] = tile(lambda x, y, f=f: water_px(x, y, f))
        for k, fn in EDGE.items():
            out[f"pool_{k}_{f}"] = pool(lambda x, y, fn=fn: -fn(x, y), f)  # water away from side k
        for a, b in (("s", "e"), ("s", "w"), ("n", "e"), ("n", "w")):
            out[f"pool_{a}{b}_{f}"] = pool(lambda x, y, a=a, b=b: -max(EDGE[a](x, y), EDGE[b](x, y)), f)
    return out


def track():
    """Vertical mine-track overlay (transparent between ties) to lay over any
    floor; the horizontal piece is this one transposed."""
    c = Canvas(T, T)
    for y in range(T):
        if y % 4 == 1:  # sleeper
            for x in range(1, 15):
                c.px(x, y, WOOD[3] if x < 3 else WOOD[1] if x > 12 else WOOD[2])
                c.px(x, y + 1, WOOD[1])
        for x, col in ((3, METAL[3]), (4, METAL[1]), (11, METAL[3]), (12, METAL[1])):
            c.px(x, y, col)
    return c


# --------------------------------------------------------------------- props

def glow(img, col, r, cx=None, cy=None, a=110):
    """Soft coloured halo composited behind a sprite (pad the canvas for it)."""
    cx = img.width / 2 if cx is None else cx
    cy = img.height / 2 if cy is None else cy
    halo = Image.new("RGBA", img.size, (0, 0, 0, 0))
    for y in range(img.height):
        for x in range(img.width):
            d = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.25) / r
            if d < 1:
                k = (1 - d) ** 1.6
                k = round(k * 4) / 4  # banded, keeps it pixel-art
                if k:
                    halo.putpixel((x, y), col[:3] + (int(a * k),))
    return Image.alpha_composite(halo, img)


def spike(c, cx, base, top, hw, rmp, down=False):
    """Cone of rock, lit on the left, with ring bands."""
    for y in range(min(base, top), max(base, top) + 1):
        t = abs(y - base) / max(1, abs(top - base))
        half = hw * (1 - t) ** 0.85
        for x in range(int(cx - half - 0.5), int(cx + half + 0.5) + 1):
            if abs(x + 0.5 - cx) > half + 0.5:
                continue
            nx = (x + 0.5 - cx) / max(1, half)
            l = -0.85 * nx + 0.1 + (0.0 if down else -0.25 * (1 - t))
            if (y + int(cx)) % 5 == 0:
                l -= 0.35
            c.px(x, y, band(rmp, l))


def stalagmite(big):
    c = Canvas(18, 30) if big else Canvas(12, 18)
    if big:
        spike(c, 9, 27, 2, 7.5, ROCK[1:6])
        spike(c, 4, 27, 17, 3, ROCK[1:6])
        spike(c, 14, 27, 20, 2.5, ROCK[1:6])
        c.shadows.append((9, 27, 8, 2.2, 90))
    else:
        spike(c, 6, 15, 2, 4.5, ROCK[1:6])
        c.shadows.append((6, 15, 5, 1.8, 90))
    return c


def stalactite():
    c = Canvas(16, 22)
    for x in range(1, 15):  # stub of ceiling it hangs from
        c.px(x, 1, ROCK[2]); c.px(x, 2, ROCK[3] if x < 8 else ROCK[2])
    spike(c, 8, 3, 20, 5.5, ROCK[1:6], down=True)
    spike(c, 3.5, 3, 10, 2.2, ROCK[1:6], down=True)
    spike(c, 12.5, 3, 13, 2.5, ROCK[1:6], down=True)
    c.px(8, 21, WATER[4])  # drip
    return c


def prism(c, x0, base, w, h, lean, rmp):
    """One crystal: left face lit, right face shaded, pointed lit tip."""
    tip_h = max(2, w // 2 + 1)
    mid = x0 + w / 2
    for y in range(base - h, base + 1):
        for x in range(x0, x0 + w):
            sx = x + round(lean * (base - y) / max(1, h))
            if y < base - h + tip_h:  # tip
                k = (y - (base - h)) / tip_h
                if abs(x + 0.5 - mid) > k * w / 2 + 0.5:
                    continue
            left = x + 0.5 < mid
            l = 0.45 if left else -0.45
            if y < base - h + tip_h:
                l += 0.6
            if x == x0 or x == x0 + w - 1:
                l -= 0.25
            c.px(sx, y, band(rmp, l))
    sx = x0 + round(lean * 0.3) + 1
    c.px(sx, base - h + tip_h + 1, rmp[5])
    c.px(sx, base - h + tip_h + 2, rmp[4])


def crystals(rmp):
    c = Canvas(22, 24)
    for x0, base, w, h, lean in ((2, 21, 4, 9, -2), (15, 21, 4, 10, 2), (7, 21, 6, 18, 0), (12, 22, 4, 12, 1), (5, 22, 3, 6, -1)):
        prism(c, x0, base, w, h, lean, rmp)
    for x in range(2, 20):  # rocky socket
        for y in (21, 22):
            if c.get(x, y) is None or y == 22:
                c.px(x, y, ROCK[3] if x < 9 else ROCK[2])
    c.shadows.append((11, 22, 9, 2, 80))
    return c


def glowshrooms():
    c = Canvas(18, 15)
    for cx, cy, r, stem in ((5, 6, 3.4, 6), (12, 4, 4, 8), (14, 10, 2.2, 3), (3, 11, 1.8, 2)):
        rect(c, round(cx) - 1, round(cy), 2, stem, BONE[2])
        c.px(round(cx), round(cy) + 1, BONE[1])
        blob(c, cx, cy, r, r * 0.7, SHROOM)
        for y in range(round(cy) + 1, c.h):
            for x in range(c.w):
                if c.get(x, y) in SHROOM:
                    c.px(x, y, None)
        c.px(round(cx) - 1, round(cy - r * 0.35), SHROOM[4])
        for x in range(round(cx - r) + 1, round(cx + r)):  # gills
            c.px(x, round(cy) + 1, SHROOM[0]) if c.get(x, round(cy) + 1) is None else None
    c.shadows.append((9, 14, 8, 1.5, 60))
    return c


def node(seed, specks=None, gem=None):
    """Mineable rock: a lumpy boulder with ore specks or a crystal poking out."""
    c = Canvas(22, 18)
    blob(c, 11, 10, 9, 6.5, ROCK[1:6], dither=True)
    blob(c, 7, 8, 4.5, 4, ROCK[2:6])
    for y in range(15, 18):
        for x in range(c.w):
            c.p[y][x] = None
    for x in range(3, 20):
        if c.get(x, 14):
            c.px(x, 14, ROCK[1] if x > 9 else ROCK[2])
    line(c, 12, 7, 14, 11, ROCK[1])
    if specks:
        for i, (x, y) in enumerate(((6, 8), (11, 6), (15, 9), (9, 11), (16, 12), (5, 12))):
            c.px(x, y, specks[3]); c.px(x + 1, y, specks[2]); c.px(x, y + 1, specks[1]); c.px(x + 1, y + 1, specks[0])
    if gem:
        prism(c, 12, 9, 4, 9, 1, gem)
        prism(c, 15, 11, 3, 6, 2, gem)
    c.shadows.append((11, 15, 10, 2, 90))
    return c


def boulders():
    c = Canvas(26, 16)
    blob(c, 8, 8, 7, 5.5, ROCK[1:6], dither=True)
    blob(c, 18, 10, 5.5, 4, ROCK[1:6], dither=True)
    blob(c, 23, 12, 2.5, 2, ROCK[2:6])
    for y in range(14, 16):
        for x in range(c.w):
            c.p[y][x] = None
    c.shadows.append((13, 13.5, 12, 2, 90))
    return c


def minecart():
    c = Canvas(26, 22)
    for y in range(6, 17):  # tub, wider at the top
        inset = (y - 6) // 4
        for x in range(2 + inset, 24 - inset):
            t = (x - 2) / 21
            col = band(METAL, 0.5 - t * 1.0)
            if y in (7, 15) or x in (7, 18):
                col = METAL[1] if x > 12 else METAL[2]  # riveted bands
            c.px(x, y, col)
    for x in (4, 9, 16, 21):
        c.px(x, 7, METAL[4]); c.px(x, 15, METAL[3])
    for x in range(2, 24):
        c.px(x, 6, METAL[3])
    for gx, gy, rmp in ((6, 4, GOLD), (11, 3, ROCK[2:6]), (15, 4, GOLD), (19, 4, ROCK[2:6]), (9, 5, ROCK[2:6]), (13, 5, GOLD)):
        blob(c, gx, gy + 1, 2.4, 2, rmp)
    for wx in (7, 18):  # wheels
        blob(c, wx, 18, 2.8, 2.8, METAL[:4])
        c.px(wx, 18, METAL[0])
    c.shadows.append((13, 20, 11, 2, 90))
    return c


def beam():
    """Mine support frame: two posts and a header, drawn over the cave mouth."""
    c = Canvas(36, 38)
    for x0 in (2, 29):
        for y in range(6, 36):
            for x in range(x0, x0 + 5):
                col = (WOOD[4], WOOD[3], WOOD[3], WOOD[2], WOOD[1])[x - x0]
                if (y * 3 + x) % 11 == 0:
                    col = WOOD[1]
                c.px(x, y, col)
    for y in range(3, 9):
        for x in range(1, 35):
            col = WOOD[4] if y == 3 else WOOD[1] if y == 8 else WOOD[3] if y < 6 else WOOD[2]
            if (x * 5 + y) % 13 == 0:
                col = WOOD[1]
            c.px(x, y, col)
    for x, y in ((4, 5), (31, 5), (4, 12), (31, 12)):
        c.px(x, y, METAL[3]); c.px(x, y + 1, METAL[1])
    for y in range(9, 14):  # corner braces
        c.px(7 + (y - 9), y, WOOD[2]); c.px(8 + (y - 9), y, WOOD[1])
        c.px(28 - (y - 9), y, WOOD[2]); c.px(27 - (y - 9), y, WOOD[1])
    return c


def entrance():
    """Overworld mine mouth: a layered rock outcrop with a mossy cap and vines,
    a deep arched opening with teeth, a braced timber frame with a skull
    plaque, two lit torches, and a track running out onto the grass."""
    from valley import GRASS, LEAF
    c = Canvas(64, 60)
    blob(c, 32, 34, 29, 22, ROCK[1:6], dither=True)
    blob(c, 10, 43, 9, 11, ROCK[1:6], dither=True)
    blob(c, 54, 42, 9, 12, ROCK[1:6], dither=True)
    blob(c, 22, 18, 10, 7, ROCK[2:6])
    clip = 55
    for y in range(clip, c.h):
        for x in range(c.w):
            c.p[y][x] = None
    for y in range(c.h):  # strata: wavy ledges, a dark seam with a lit lip under it
        for x in range(c.w):
            col = c.get(x, y)
            if col not in ROCK:
                continue
            k = (y + round(math.sin(x * 0.35) * 1.5)) % 8
            i = ROCK.index(col)
            if k == 0:
                c.px(x, y, ROCK[max(0, i - 2)])
            elif k == 1:
                c.px(x, y, ROCK[min(5, i + 1)])
    for x in range(c.w):  # mossy cap along the top
        top = next((y for y in range(c.h) if c.get(x, y) in ROCK), None)
        if top is None or top > 40:
            continue
        for d in range(2 + (h2(x, 0, 7) > 0.5)):
            c.px(x, top + d, GRASS[4] if d == 0 else GRASS[3] if d == 1 else GRASS[2])
        if h2(x, 1, 7) < 0.3:
            c.px(x, top - 1, GRASS[5])
    for vx, L in ((13, 10), (17, 7), (46, 9), (50, 6)):  # hanging vines
        top = next(y for y in range(c.h) if c.get(vx, y) in GRASS)
        for i in range(L):
            c.px(vx + (i // 4) % 2, top + 1 + i, LEAF[3] if i % 3 else LEAF[4])
            if i % 3 == 1:
                c.px(vx - 1 + 2 * ((i // 3) % 2), top + 1 + i, LEAF[5])
    # mouth: deep arch, rim lit then black
    cx, top, base, hw = 32, 29, 54, 11
    for y in range(top, base + 1):
        half = hw if y >= top + 8 else math.sqrt(max(0, 1 - ((top + 8 - y) / 8) ** 2)) * hw
        for x in range(int(cx - half), int(cx + half + 1)):
            edge = min(x - (cx - half), cx + half - x, y - top + 0.5)
            col = ROCK[1] if edge < 1.2 else ROCK[0] if edge < 3 else DARK
            if y > base - 4 and edge >= 3:
                col = FLOOR[1] if y == base else FLOOR[0] if y >= base - 1 else ROCK[0]
            c.px(x, y, col)
    for tx, L in ((25, 3), (29, 4), (34, 3), (38, 4)):  # rock teeth
        for i in range(L):
            for x in range(tx, tx + max(1, 3 - i)):
                c.px(x, top + 3 + i, ROCK[3] if x == tx else ROCK[2])
    for x, y in ((28, 44), (29, 43), (36, 46), (35, 47)):  # crystals glinting deep inside
        c.px(x, y, BLUE[3] if (x + y) % 2 else BLUE[4])
    # track out of the mouth
    for y in range(44, 60):
        if y % 3 == 0:
            for x in range(26, 39):
                c.px(x, y, WOOD[2] if x < 32 else WOOD[1])
        for x, col in ((27, METAL[3]), (28, METAL[1]), (36, METAL[3]), (37, METAL[1])):
            c.px(x, y, col)
    # timber frame
    for x0 in (18, 43):
        for y in range(28, 55):
            for x in range(x0, x0 + 4):
                col = (WOOD[4], WOOD[3], WOOD[2], WOOD[1])[x - x0]
                if (y * 3 + x) % 9 == 0:
                    col = WOOD[1]
                c.px(x, y, col)
        c.px(x0 + 1, 31, METAL[3]); c.px(x0 + 1, 50, METAL[3])
    for y in range(23, 29):
        for x in range(15, 50):
            col = WOOD[4] if y == 23 else WOOD[0] if y == 28 else WOOD[3] if y < 26 else WOOD[2]
            if (x * 7 + y) % 13 == 0:
                col = WOOD[1]
            c.px(x, y, col)
    for x in (16, 48):
        c.px(x, 25, METAL[3]); c.px(x, 26, METAL[1])
    for i in range(5):  # braces
        c.px(22 + i, 29 + i, WOOD[3]); c.px(22 + i, 30 + i, WOOD[1])
        c.px(42 - i, 29 + i, WOOD[3]); c.px(42 - i, 30 + i, WOOD[1])
    blob(c, 32, 25.5, 2.6, 2.2, BONE)  # skull plaque
    c.px(31, 25, DARK); c.px(33, 25, DARK); c.px(32, 27, BONE[0])
    # torches on the posts, and their warm light on the rock
    flames = []
    for tx in (15, 48):
        rect(c, tx, 36, 2, 6, WOOD[3]); c.px(tx + 1, 36, WOOD[1])
        rect(c, tx - 1, 35, 4, 1, METAL[2])
        for y, xs in ((31, (0,)), (32, (0, 1)), (33, (-1, 0, 1)), (34, (-1, 0, 1, 2))):
            for dx in xs:
                c.px(tx + dx, y, FLAME[3] if dx == 0 and y > 32 else FLAME[2] if y > 31 else FLAME[1])
        flames.append((tx + 0.5, 33))
    for y in range(c.h):
        for x in range(c.w):
            col = c.get(x, y)
            if col is None or col in FLAME:
                continue
            d = min(math.hypot(x - fx, y - fy) for fx, fy in flames)
            if d < 13:
                c.px(x, y, mix(col, FLAME[2], round((1 - d / 13) * 3) / 3 * 0.35))
    # rubble and a crystal at the foot
    for bx, by, rx, ry in ((7, 53, 3.4, 2.2), (57, 52, 3.4, 2.6), (12, 55, 2, 1.4), (52, 55, 1.8, 1.3)):
        blob(c, bx, by, rx, ry, ROCK[2:6])
    prism(c, 49, 55, 4, 8, 1, BLUE)
    prism(c, 53, 55, 3, 5, 2, BLUE)
    c.shadows.append((32, 55, 30, 3.5, 90))
    return c


def torch(f):
    c = Canvas(10, 18)
    rect(c, 4, 9, 2, 8, WOOD[3]); c.px(5, 9, WOOD[2])
    for y in range(9, 17):
        c.px(5, y, WOOD[2])
    rect(c, 3, 9, 4, 2, METAL[2]); c.px(6, 10, METAL[1])
    sway = (0, 1)[f]
    for y, hw in ((2, 0), (3, 1), (4, 1), (5, 2), (6, 2), (7, 2), (8, 1)):
        for x in range(5 - hw + (sway if y < 5 else 0), 5 + hw + 1 + (sway if y < 5 else 0)):
            c.px(x - 1 if x > 5 else x, y, FLAME[1] if abs(x - 5) == hw and hw else FLAME[2])
    for y in (5, 6, 7):
        c.px(4, y, FLAME[3])
    c.px(4 + sway, 1 + f, FLAME[0] if f else None)
    return c


def bones():
    c = Canvas(18, 10)
    blob(c, 6, 4, 3.5, 3, BONE)  # skull
    for y in range(6, 8):
        for x in range(4, 9):
            c.px(x, y, BONE[2] if x < 7 else BONE[1])
    c.px(5, 4, DARK); c.px(4, 4, DARK); c.px(8, 4, DARK); c.px(6, 6, BONE[0]); c.px(6, 7, DARK)
    line(c, 10, 7, 16, 4, BONE[2]); line(c, 10, 8, 16, 5, BONE[1])
    for x, y in ((9, 7), (16, 3), (16, 6), (9, 9)):
        c.px(x, y, BONE[3])
    line(c, 11, 3, 15, 8, BONE[2])
    c.shadows.append((9, 8.5, 8, 1.5, 70))
    return c


def cobweb():
    """Corner web, top-left anchored; mirror for the other corner."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    col = (230, 230, 240)
    for ang in (0, 0.4, 0.8, 1.2, 1.57):
        for k in range(16):
            x, y = round(math.cos(ang) * k), round(math.sin(ang) * k)
            if x < 16 and y < 16:
                img.putpixel((x, y), col + (150,))
    for r in (4, 8, 12):
        for i in range(24):
            a = i / 23 * 1.57
            x, y = round(math.cos(a) * r * (1 - 0.12 * math.sin(a * 2))), round(math.sin(a) * r * (1 - 0.12 * math.sin(a * 2)))
            if x < 16 and y < 16:
                img.putpixel((x, y), col + (110,))
    return img


def ladder_hole():
    c = Canvas(T, T)
    blob(c, 8, 8, 7, 6, ROCK[1:5])
    blob(c, 8, 8.6, 5.4, 4.6, [DARK, DARK, ROCK[0], ROCK[0]])
    for y in range(3, 15):
        if c.get(5, y) == DARK or y < 6:
            c.px(5, y, WOOD[3]); c.px(10, y, WOOD[2])
        if y % 3 == 0 and c.get(7, y) == DARK:
            for x in range(6, 10):
                c.px(x, y, WOOD[3] if x < 8 else WOOD[2])
    for x in (5, 10):
        c.px(x, 2, WOOD[4])
    return c


def puddle():
    c = Canvas(18, 9)
    blob(c, 9, 4.5, 8, 3.5, [WATER[1], WATER[1], WATER[2], WATER[3]])
    line(c, 5, 3, 8, 3, WATER[4]); c.px(12, 5, WATER[5])
    return c


def pickaxe():
    c = Canvas(18, 18)
    line(c, 4, 15, 13, 4, WOOD[3]); line(c, 5, 15, 14, 4, WOOD[1])
    for i, (x, y) in enumerate(((7, 2), (8, 2), (9, 3), (10, 3), (11, 4), (12, 5), (13, 6), (14, 7), (15, 9), (16, 11))):
        c.px(x, y, METAL[3] if i < 5 else METAL[2]); c.px(x, y + 1, METAL[1])
    c.px(6, 2, METAL[4]); c.px(16, 12, METAL[1])
    return c


# ------------------------------------------------------------- game map

# Floor rooms carved out of solid rock (x1, y1, x2, y2 inclusive, tile coords),
# then water and rock pillars. 48x36 like the outdoor areas; the corridor at
# x 20-24 runs off the bottom edge, which is the way back out to the fields.
MAP_W, MAP_H = 48, 36
ROOMS = [(4, 6, 30, 27), (6, 3, 10, 5), (34, 4, 44, 14), (30, 10, 34, 12), (31, 18, 45, 31), (30, 20, 32, 24),
         (20, 27, 24, 35), (38, 15, 40, 17), (12, 28, 19, 31)]
POOLS = [(36, 22, 43, 27)]
PILLARS = [(10, 10, 12, 13), (22, 14, 25, 17), (15, 20, 16, 22), (38, 8, 39, 10), (4, 22, 6, 27), (28, 6, 30, 8)]


def cave_rows():
    g = [["#"] * MAP_W for _ in range(MAP_H)]
    for rects, ch in ((ROOMS, "."), (POOLS, "~"), (PILLARS, "#")):
        for x1, y1, x2, y2 in rects:
            for y in range(y1, y2 + 1):
                for x in range(x1, x2 + 1):
                    g[y][x] = ch
    return ["".join(r) for r in g]


def cave_ground(rows):
    """Bake the whole map: every cell picks its pixels from its neighbours, so
    lips, corners, faces and pool rims line up in any combination."""
    def at(x, y):  # off-map repeats the edge cell (rock, or the exit corridor)
        return rows[max(0, min(MAP_H - 1, y))][max(0, min(MAP_W - 1, x))]

    def face(x, y):  # 0 = wall_hi, 16 = wall_lo, None = plain rock top
        if at(x, y) != "#":
            return None
        if at(x, y + 1) != "#":
            return 16
        if at(x, y + 2) != "#":
            return 0
        return None

    img = Image.new("RGBA", (MAP_W * T, MAP_H * T))
    side = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "w": (-1, 0)}
    for cy in range(MAP_H):
        for cx in range(MAP_W):
            t = at(cx, cy)
            v = 1 if h2(cx, cy, 5) < 0.3 else 0
            for y in range(T):
                for x in range(T):
                    if t == "#":
                        f = face(cx, cy)
                        if f is None:
                            col = rock_px(x, y)
                        else:
                            col = face_px(x, y + f)
                            for k in ("w", "e"):  # face meets rock that isn't a face: rock creeps in
                                nx = cx + side[k][0]
                                if at(nx, cy) == "#" and face(nx, cy) != f:
                                    d = EDGE[k](x, y)
                                    if d >= 1:
                                        col = rock_px(x, y)
                                    elif d >= 0:
                                        col = ROCK[4]
                                    elif d >= -1 and col not in (DARK, ROCK[0]):
                                        col = ROCK[0]
                    elif t == ".":
                        rock = {k: at(cx + dx, cy + dy) == "#" for k, (dx, dy) in side.items()}
                        ds = [EDGE[k](x, y) for k in ("s", "e", "w") if rock[k]]
                        for a, b in (("s", "e"), ("s", "w")):
                            if not rock[a] and not rock[b] and at(cx + side[b][0], cy + 1) == "#":
                                ds.append(min(EDGE[a](x, y), EDGE[b](x, y)))
                        d = max(ds) if ds else -9
                        col = (rock_px(x, y) if d >= 1 else ROCK[4] if d >= 0 else DARK if d >= -1
                               else FLOOR[1] if d >= -2 else floor_px(x, y, v))
                        if rock["n"] and y < 4 and d < 0:
                            col = mix(col, DARK, 0.55 - y * 0.12)
                    else:
                        dry = {k: at(cx + dx, cy + dy) != "~" for k, (dx, dy) in side.items()}
                        ds = [-EDGE[k](x, y) for k in side if dry[k]]
                        for a in ("n", "s"):
                            for b in ("e", "w"):
                                if not dry[a] and not dry[b] and at(cx + side[b][0], cy + side[a][1]) != "~":
                                    ds.append(-min(EDGE[a](x, y), EDGE[b](x, y)))
                        d = min(ds) if ds else 9
                        col = (water_px(x, y) if d >= 2 else WATER[0] if d >= 1
                               else (FLOOR[4] if (x + y) % 4 else FLOOR[3]) if d >= 0 else FLOOR[1] if d >= -1 else floor_px(x, y, v))
                    img.putpixel((cx * T + x, cy * T + y), col)
    return img


# ------------------------------------------------------------------ output

def outlined(c):
    c.outline()
    return c.image()


def pad(img, p):
    out = Image.new("RGBA", (img.width + 2 * p, img.height + 2 * p), (0, 0, 0, 0))
    out.alpha_composite(img, (p, p))
    return out


def compose(tiles, props):
    """Sample cave: rock border, cliff face, floor, a pool, a mine track."""
    W, H = 26, 16
    img = Image.new("RGBA", (W * T, H * T))

    def put(im, x, y):
        img.alpha_composite(im, (int(x), int(y)))

    for ty in range(H):
        for tx in range(W):
            if ty < 2 or ty == H - 1:
                name = "rock"
            elif tx == 0:
                name = "rock" if ty < 4 else "lip_w" if ty < H - 2 else "lip_sw"
            elif tx == W - 1:
                name = "rock" if ty < 4 else "lip_e" if ty < H - 2 else "lip_se"
            elif ty in (2, 3):
                base = "wall_hi" if ty == 2 else "wall_lo"
                name = base + ("_w" if tx == 1 else "_e" if tx == W - 2 else "")
            elif ty == H - 2:
                name = "lip_s"
            elif ty == 4:
                name = "floor_shadow"
            else:
                name = "floor_1" if h2(tx, ty, 5) < 0.3 else "floor_0"
            put(tiles[name], tx * T, ty * T)
    # pool in the lower right
    px0, px1, py0, py1 = 17, 23, 8, 13
    for ty in range(py0, py1 + 1):
        for tx in range(px0, px1 + 1):
            n, s, w, e = ty == py0, ty == py1, tx == px0, tx == px1
            key = ("n" if n else "s" if s else "") + ("w" if w else "e" if e else "")
            put(tiles[f"pool_{key}_0" if key else "pool_0"], tx * T, ty * T)
    for tx in range(1, 16):
        put(tiles["track_h"], tx * T, 10 * T)
    for ty in range(5, 10):
        put(tiles["track_v"], 4 * T, ty * T)

    def stand(name, cx, bottom):
        im = props[name]
        put(im, cx * T - im.width / 2, bottom * T - im.height)

    for x in (6, 13, 20):  # torches on the face
        stand("torch_0", x + 0.5, 3.6)
    stand("cobweb", 1.5, 3.0)
    put(props["cobweb"].transpose(Image.FLIP_LEFT_RIGHT), (W - 2) * T, 2 * T)
    stand("beam", 3.5, 4.6)
    placed = [
        ("stalagmite_big", 2.4, 8.2), ("stalagmite_small", 9.4, 6.4), ("crystal_blue", 12.2, 7.2),
        ("node_gold", 15.3, 6.3), ("node_iron", 18.6, 6.1), ("crystal_purple", 22.6, 6.6),
        ("glowshrooms", 16.4, 9.2), ("glowshrooms", 24, 13.6), ("boulders", 7.5, 13.6), ("bones", 11, 13.2),
        ("minecart", 8.5, 11.05), ("node_crystal", 2.7, 13.6), ("barrel", 14.4, 8.5), ("crate", 16.2, 8.6),
        ("chest", 13.6, 14.2), ("pickaxe", 6.3, 8.7), ("puddle", 10.2, 8.6), ("stalagmite_small", 24.2, 8.4),
        ("ladder_hole", 21.5, 5.9),
    ]
    for name, x, y in sorted(placed, key=lambda p: p[2]):
        stand(name, x, y)
    put(props["stalactite"], 9 * T, 4 * T - 10)
    return img


def lit(scene, lights, ambient=0.5):
    """Darken the scene, then add back light pools (preview mood only)."""
    shade = Image.new("RGBA", scene.size, (12, 8, 22, int(255 * ambient)))
    for lx, ly, r, col, a in lights:
        for y in range(max(0, int(ly - r)), min(scene.height, int(ly + r))):
            for x in range(max(0, int(lx - r)), min(scene.width, int(lx + r))):
                d = math.hypot(x - lx, y - ly) / r
                if d < 1:
                    k = round((1 - d) * 4) / 4
                    s = shade.getpixel((x, y))
                    shade.putpixel((x, y), (*s[:3], int(s[3] * (1 - k))))
    out = Image.alpha_composite(scene, shade)
    tint = Image.new("RGBA", scene.size, (0, 0, 0, 0))
    for lx, ly, r, col, a in lights:
        for y in range(max(0, int(ly - r)), min(scene.height, int(ly + r))):
            for x in range(max(0, int(lx - r)), min(scene.width, int(lx + r))):
                d = math.hypot(x - lx, y - ly) / r
                if d < 0.8:
                    k = round((1 - d / 0.8) * 3) / 3
                    if k:
                        tint.putpixel((x, y), col[:3] + (int(a * k),))
    return Image.alpha_composite(out, tint)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tiles = {"floor_0": tile(lambda x, y: floor_px(x, y, 0)), "floor_1": tile(lambda x, y: floor_px(x, y, 1)),
             "floor_shadow": tile(shadow_floor_px), "rock": tile(rock_px),
             "track_v": track()}
    tiles.update(face_tiles())
    tiles.update(edge_tiles())
    tiles = {k: v.image() for k, v in tiles.items()}
    tiles["track_h"] = tiles["track_v"].transpose(Image.TRANSPOSE)

    props = {
        "stalagmite_big": outlined(stalagmite(True)), "stalagmite_small": outlined(stalagmite(False)),
        "stalactite": outlined(stalactite()),
        "crystal_blue": glow(pad(outlined(crystals(BLUE)), 6), BLUE[3], 18, cy=20),
        "crystal_purple": glow(pad(outlined(crystals(PURPLE)), 6), PURPLE[3], 18, cy=20),
        "glowshrooms": glow(pad(outlined(glowshrooms()), 5), SHROOM[3], 14, cy=13),
        "node_gold": outlined(node(1, specks=GOLD)), "node_iron": outlined(node(2, specks=IRON)),
        "node_crystal": glow(pad(outlined(node(3, gem=BLUE)), 4), BLUE[3], 14, cy=14),
        "boulders": outlined(boulders()), "minecart": outlined(minecart()), "beam": outlined(beam()),
        "cave_entrance": outlined(entrance()), "bones": outlined(bones()), "cobweb": cobweb(),
        "ladder_hole": tiles_img(ladder_hole()), "puddle": tiles_img(puddle()), "pickaxe": outlined(pickaxe()),
        "torch_0": glow(pad(outlined(torch(0)), 6), FLAME[2], 12, cy=11),
        "torch_1": glow(pad(outlined(torch(1)), 6), FLAME[2], 13, cy=11),
        "barrel": outlined(barrel()), "crate": outlined(crate()), "chest": chest().image(),
    }
    for k, im in {**tiles, **props}.items():
        if k not in ("barrel", "crate", "chest"):  # borrowed from market / coast
            im.save(OUT / f"{k}.png")

    groups = [("Floor", [tiles["floor_0"], tiles["floor_1"], tiles["floor_shadow"]]), ("Rock", [tiles["rock"]]),
              ("Face", [tiles["wall_hi_w"], tiles["wall_hi"], tiles["wall_hi_e"]]),
              ("Face lo", [tiles["wall_lo_w"], tiles["wall_lo"], tiles["wall_lo_e"]]),
              ("Lips", [tiles[k] for k in ("lip_w", "lip_s", "lip_e", "lip_sw", "lip_se", "lip_sw_out", "lip_se_out")]),
              ("Pool", [tiles[k] for k in ("pool_0", "pool_n_0", "pool_s_0", "pool_w_0", "pool_e_0",
                                           "pool_nw_0", "pool_ne_0", "pool_sw_0", "pool_se_0")]),
              ("Track", [tiles["track_h"], tiles["track_v"]])]
    preview(groups, scale=6, max_w=180, bg="checker").save(OUT / "tiles_preview.png")
    names = [k for k in props if k not in ("barrel", "crate", "chest")]
    preview([(k.replace("_", " "), [props[k]]) for k in names], scale=4, max_w=330, bg="checker").save(OUT / "props_preview.png")

    scene = compose(tiles, props)
    lights = [(x * T + 8, 3.2 * T, 70, FLAME[2], 50) for x in (6, 13, 20)]
    lights += [(12.2 * T, 6.6 * T, 44, BLUE[3], 45), (22.6 * T, 6 * T, 44, PURPLE[3], 45),
               (16.4 * T, 8.8 * T, 34, SHROOM[3], 40), (24 * T, 13.2 * T, 34, SHROOM[3], 40),
               (2.7 * T, 13.2 * T, 30, BLUE[3], 40)]
    scene = lit(scene, lights)
    scene.resize((scene.width * 3, scene.height * 3), Image.NEAREST).save(OUT / "cave_preview.png")
    ent = Image.new("RGBA", (props["cave_entrance"].width + 24, props["cave_entrance"].height + 12))
    from valley import tex_grass
    g = tex_grass()
    for gx in range(0, ent.width, g.width):
        for gy in range(0, ent.height, g.height):
            ent.paste(g, (gx, gy))
    ent.alpha_composite(props["cave_entrance"], (12, 6))
    ent.resize((ent.width * 5, ent.height * 5), Image.NEAREST).save(OUT / "entrance_preview.png")
    rows = cave_rows()
    cave_ground(rows).save(OUT / "cave_ground.png")
    (OUT / "cave_map.json").write_text(json.dumps({"w": MAP_W, "h": MAP_H, "rows": rows}, indent=0))
    print("cave:", len(tiles), "tiles +", len(names), "props + 4 previews ->", OUT)


def tiles_img(c):
    return c.image()


if __name__ == "__main__":
    main()
