#!/usr/bin/env python3
"""Medieval shop interior tileset in a Gen-3 style (Pillow only, original art).

16x16 floor / wall / edge tiles plus furniture sprites in multiples of 16.
Saves each piece as a native PNG in out/interior, then writes a labelled tile
sheet and a sample shop room built only from those pieces.

    python3 tools/pixelgen/interior.py
"""
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from market import GL_BLU, GL_GLD, GL_GRN, GL_PNK, GL_RED, GL_TEAL, barrel, bottle, crate, flask, sack  # noqa: E402
from pixel import Canvas, blob, hx, mix, ramp, rect, sprite  # noqa: E402

OUT = Path(__file__).resolve().parent / "out" / "interior"
T = 16

VOID = hx("120e0c")
DW = ramp("2a1a10", "4a2c18", "6b4226", "8a5a32", "a8743f", "c89458")  # wood, dark -> light
STONE = ramp("3a3640", "5a5662", "7a7684", "9a96a4", "bab6c4")
MORTAR = hx("2a2630")
PLASTER = ramp("c4b592", "d8cbab", "e9dfc4", "f5eedb")
METAL = ramp("2a2a36", "4a4a5a", "7c7c8e", "b8b8c8", "e4e4ee")
BRASS = ramp("6b4a12", "a8781e", "d9a934", "f5d36a")
CLOTH = ramp("4a1018", "7a1c26", "a82a32", "d04a48")
TERRA = ramp("6a2e16", "9a4a24", "c46a3a", "e09060")
FIRE = [hx("c83a1a"), hx("f08a2a"), hx("ffcf40"), hx("fff2b8")]
E_OUT, E_MID, E_HI = DW[0], DW[2], DW[4]


def h2(x, y, s):
    """Cheap deterministic per-pixel noise in [0, 1)."""
    v = (x * 374761393 + y * 668265263 + s * 1013904223) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return (v ^ (v >> 16)) / 4294967296


# ------------------------------------------------------------------- floors

def floor_planks():
    c = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            i, k = y // 4, y % 4
            if k == 3 or (x + i * 6) % 16 == 0:
                col = DW[1]
            else:
                col = DW[4] if k == 0 else DW[3]
                if k in (1, 2) and (x + i * 3 + k * 5) % 7 == 0:
                    col = DW[2]  # grain dashes
            c.px(x, y, col)
    c.px(4, 6, DW[2]); c.px(11, 13, DW[2]); c.px(12, 13, DW[1])
    return c


def floor_stone():
    c = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            c.px(x, y, MORTAR)
    stones = [(0, 0, 7, 5), (9, 0, 14, 8), (0, 7, 4, 14), (6, 10, 14, 14), (6, 7, 7, 8)]
    for n, (x0, y0, x1, y1) in enumerate(stones):
        base = 2 if n % 2 == 0 else 3
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if x == x0 and y == y0:
                    col = STONE[4]
                elif x == x0 or y == y0:
                    col = STONE[min(4, base + 1)]
                elif x == x1 or y == y1:
                    col = STONE[base - 1]
                else:
                    col = STONE[base]
                    r = h2(x, y, n)
                    if r < 0.08:
                        col = STONE[base - 1]
                    elif r > 0.94:
                        col = STONE[min(4, base + 1)]
                c.px(x, y, col)
    return c


# -------------------------------------------------------------------- walls

def wall_upper():
    """Plaster between a ceiling beam and a mid beam (tudor style)."""
    c = Canvas(T, T)
    for x in range(T):
        c.px(x, 0, DW[0]); c.px(x, 1, DW[3]); c.px(x, 2, DW[1])
        for y in range(3, 13):
            col = PLASTER[1] if y == 3 else PLASTER[2]
            r = h2(x, y, 7)
            if r < 0.06:
                col = PLASTER[1]
            elif r > 0.95:
                col = PLASTER[3]
            c.px(x, y, col)
        c.px(x, 13, DW[5]); c.px(x, 14, DW[3]); c.px(x, 15, DW[1])
    for x in (3, 12):  # pegs in the beam
        c.px(x, 14, DW[1])
    return c


def wall_lower():
    """Stone wainscot under the mid beam."""
    c = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            if y >= 12:
                col = (STONE[3], STONE[2], STONE[1], STONE[0])[y - 12]
            else:
                r = y // 4
                bx, by = (x + (r % 2) * 4) % 8, y % 4
                if by == 3 or bx == 7:
                    col = MORTAR
                elif by == 0 or bx == 0:
                    col = STONE[3]
                elif by == 2 and bx == 6:
                    col = STONE[1]
                else:
                    col = STONE[2] if h2(x, y, 3) > 0.1 else STONE[1]
            c.px(x, y, col)
    return c


def wall_post():
    c = Canvas(T, T)
    for y in range(3, 13):
        c.px(6, y, DW[4]); c.px(7, y, DW[3]); c.px(8, y, DW[3]); c.px(9, y, DW[1])
        c.px(10, y, PLASTER[1])
    c.px(7, 5, DW[1]); c.px(7, 10, DW[1])
    return c


def window():
    """Small arched leaded window set into the plaster."""
    c = Canvas(T, T)
    lead = hx("3a4048")
    for y in range(3, 13):
        for x in range(3, 13):
            if y == 3 and not 6 <= x <= 9:
                continue
            if y == 4 and not 5 <= x <= 10:
                continue
            edge = x in (3, 12) or y == 12 or (y == 3) or (y == 4 and x in (5, 10))
            if edge:
                c.px(x, y, DW[1])
            elif (x + y) % 4 == 0 or (x - y) % 4 == 0:
                c.px(x, y, lead)
            else:
                c.px(x, y, mix(hx("a6d6d4"), hx("6a9eac"), (y - 4) / 8))
    c.px(5, 6, hx("e8fbf6")); c.px(6, 5, hx("e8fbf6")); c.px(5, 7, hx("cdeee8"))
    for x in range(2, 14):  # sill
        c.px(x, 12, DW[4]); c.px(x, 13, DW[2])
    return c


def torch():
    c = Canvas(T, T)
    glow = hx("f7e4b4")
    for x, y in ((6, 4), (9, 4), (5, 5), (10, 5), (5, 6), (10, 6), (6, 8), (9, 8), (5, 7), (10, 7)):
        c.px(x, y, glow)
    c.px(7, 4, FIRE[1]); c.px(8, 3, FIRE[2])
    for x in (6, 7, 8, 9):
        c.px(x, 5, FIRE[1] if x in (6, 9) else FIRE[2])
    for x in (6, 7, 8, 9):
        c.px(x, 6, FIRE[0] if x in (6, 9) else FIRE[3] if x == 7 else FIRE[2])
    c.px(7, 7, FIRE[1]); c.px(8, 7, FIRE[1])
    for y in (8, 9, 10):
        c.px(7, y, DW[3]); c.px(8, y, DW[2])
    for x in (6, 7, 8, 9):
        c.px(x, 11, METAL[1])
    c.px(7, 12, METAL[1]); c.px(7, 11, METAL[2])
    return c


def shield():
    c = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            d = ((x + 0.5 - 8) / 5.6) ** 2 + ((y + 0.5 - 8) / 5.6) ** 2
            if d > 1:
                continue
            if d > 0.72:
                col = METAL[3] if (x < 8 and y < 8) else METAL[1]
            else:
                plank = (x - 2) // 3
                col = DW[4] if plank % 2 else DW[3]
                if (x - 2) % 3 == 2:
                    col = DW[2]
            c.px(x, y, col)
    blob(c, 8, 8, 1.8, 1.8, METAL[1:4])
    c.outline()
    return c


def banner():
    c = Canvas(T, 26)
    for x in range(2, 14):
        c.px(x, 2, DW[1]); c.px(x, 1, DW[3])
    c.px(1, 1, BRASS[2]); c.px(14, 1, BRASS[2])
    for y in range(3, 24):
        for x in range(4, 12):
            if y >= 20 and abs(x - 7.5) < (y - 19):  # swallowtail cut
                continue
            if x in (4, 11) or y == 3:
                col = BRASS[2] if x == 4 or y == 3 else BRASS[1]
            else:
                col = CLOTH[3] if x == 5 else CLOTH[1] if x == 10 else CLOTH[2]
                if x == 8 and y % 3 == 0:
                    col = CLOTH[1]  # cloth fold
            c.px(x, y, col)
    for x, y in ((7, 8), (8, 8), (6, 9), (9, 9), (7, 9), (8, 9), (7, 10), (8, 10), (6, 11), (9, 11), (7, 12), (8, 12)):
        c.px(x, y, BRASS[3] if x <= 7 else BRASS[2])
    c.outline()
    return c


def fireplace():
    c = Canvas(32, 32)
    for y in range(7, 31):  # stone surround
        for x in range(1, 31):
            r = (y - 7) // 4
            bx, by = (x + (r % 2) * 3) % 6, (y - 7) % 4
            if by == 3 or bx == 5:
                col = MORTAR
            elif by == 0 or bx == 0:
                col = STONE[3]
            else:
                col = STONE[2]
            c.px(x, y, col)
    for y in range(13, 30):  # arched opening
        half = 9 if y > 15 else 9 - (16 - y)
        for x in range(16 - half, 16 + half):
            depth = min(1.0, (y - 13) / 16)
            c.px(x, y, mix(hx("140c0a"), hx("3a1a10"), depth))
    for x in range(8, 24):
        c.px(x, 13 if 10 <= x <= 21 else 14, STONE[4])
    for x0, x1, y in ((10, 21, 27), (12, 23, 28)):  # logs
        for x in range(x0, x1):
            c.px(x, y, DW[3] if x % 4 else DW[1])
    flames = [(13, 20, 26), (16, 17, 26), (19, 21, 26)]
    for fx, top, bottom in flames:
        for y in range(top, bottom + 1):
            w = max(0, (y - top) // 2)
            for x in range(fx - w, fx + w + 1):
                t = (y - top) / max(1, bottom - top)
                c.px(x, y, FIRE[0] if abs(x - fx) == w and w > 0 else FIRE[1] if t > 0.6 else FIRE[2])
        c.px(fx, top + 2, FIRE[3])
    for x in range(1, 31):  # hearth slab
        c.px(x, 30, STONE[3]); c.px(x, 31, STONE[1])
    for x in range(0, 32):  # wooden mantel
        c.px(x, 4, DW[5]); c.px(x, 5, DW[3]); c.px(x, 6, DW[1])
    for cx in (6, 25):  # candles
        c.px(cx, 3, hx("f4ecd8")); c.px(cx, 2, hx("e8dcc0")); c.px(cx, 1, FIRE[2]); c.px(cx, 0, FIRE[3])
    c.px(15, 3, BRASS[2]); c.px(16, 3, BRASS[1]); c.px(15, 2, BRASS[3])
    return c


# -------------------------------------------------------------- room edges

def edge(kind):
    """Dark-wood room border strips: left, right, bottom, bl (cut), br."""
    c = Canvas(T, T)
    cols = (E_OUT, E_MID, E_HI)
    for y in range(T):
        for x in range(T):
            col = None
            if kind == "bl":
                d = x + 15 - y
                if d < 7:
                    col = VOID
                elif d <= 9:
                    col = cols[d - 7]
                elif x <= 2:
                    col = cols[x]
                elif y >= 13:
                    col = cols[15 - y]
            else:
                if kind in ("left",) and x <= 2:
                    col = cols[x]
                if kind in ("right", "br") and x >= 13:
                    col = cols[15 - x]
                if kind in ("bottom", "br") and y >= 13 and col is None:
                    col = cols[15 - y]
            if col is not None:
                c.px(x, y, col)
    return c


# ---------------------------------------------------------------- furniture

def counter(kind):
    c = Canvas(T, T)
    for x in range(T):
        c.px(x, 0, DW[2])
        for y in range(1, 4):
            c.px(x, y, DW[4] if y != 2 or x % 8 else DW[3])
        c.px(x, 4, DW[5])
        for y in range(5, 15):
            k = x % 4
            col = DW[1] if k == 3 else DW[4] if k == 0 else DW[3]
            c.px(x, y, col)
        c.px(x, 8, METAL[1]); c.px(x, 15, DW[0])
    for x in (2, 6, 10, 14):
        c.px(x, 8, METAL[3])
    if kind == "left":
        for y in range(T):
            c.px(0, y, DW[1]); c.px(1, y, DW[5])
    if kind == "right":
        for y in range(T):
            c.px(15, y, DW[0]); c.px(14, y, DW[2])
    return c


def scale():
    c = Canvas(T, T)
    for y in range(3, 10):
        c.px(7, y, BRASS[3]); c.px(8, y, BRASS[1])
    for x in range(2, 14):
        c.px(x, 3, BRASS[2])
    c.px(7, 2, BRASS[3]); c.px(8, 2, BRASS[2])
    for y in (4, 5):
        c.px(3, y, METAL[2]); c.px(12, y, METAL[2])
    for x0 in (1, 10):
        for x in range(x0, x0 + 5):
            c.px(x, 6, BRASS[3] if x == x0 else BRASS[2]); c.px(x, 7, BRASS[1])
    c.px(2, 5, BRASS[3]); c.px(3, 5, BRASS[2])  # coins in the left pan
    for x in range(5, 11):
        c.px(x, 9, BRASS[2]); c.px(x, 10, BRASS[0])
    c.outline()
    return c


def ledger():
    c = Canvas(T, T)
    page, page_lo = hx("f4ecd2"), hx("d8cba8")
    for y in range(5, 11):
        for x in range(2, 14):
            if x in (2, 13) or y == 10:
                c.px(x, y, DW[2])
            elif x == 7 or x == 8:
                c.px(x, y, page_lo)
            else:
                c.px(x, y, page)
    for y in (6, 8):
        for x in (4, 5, 10, 11):
            c.px(x, y, hx("8a8070"))
    for i in range(6):  # quill
        c.px(13 - i, 1 + i, hx("fbfbf6") if i < 4 else hx("8a7a5a"))
        if i < 3:
            c.px(14 - i, 1 + i, hx("dcdcd4"))
    c.outline()
    return c


def potion_shelf(seed=0):
    c = Canvas(32, 32)
    rng = random.Random(40 + seed)
    rect(c, 3, 4, 26, 25, DW[1])
    for x in range(3, 29):
        if x % 6 == 0:
            for y in range(4, 29):
                c.px(x, y, DW[0])
    for x in range(1, 31):
        c.px(x, 1, DW[5]); c.px(x, 2, DW[4]); c.px(x, 3, DW[2])
    for y in range(1, 31):
        c.px(1, y, DW[4]); c.px(2, y, DW[3]); c.px(29, y, DW[2]); c.px(30, y, DW[1])
    glass = [GL_RED, GL_GRN, GL_BLU, GL_PNK, GL_TEAL, GL_GLD]
    book_cols = [CLOTH, ramp("1e3a6a", "2e5aa0", "4a7ad0"), ramp("1e4a24", "2f7a36", "4fa04a"), BRASS]
    for shelf_i, sy in enumerate((12, 20, 28)):
        for x in range(3, 29):
            c.px(x, sy - 1, DW[4]); c.px(x, sy, DW[2])
        x = 4
        while x < 27:
            if shelf_i == 0:
                g = rng.choice(glass)
                if rng.random() < 0.4 and x < 25:
                    flask(c, x + 2, sy - 1, g); x += 6
                else:
                    bottle(c, x, sy - 1, g); x += 4
            elif shelf_i == 1:
                if rng.random() < 0.5:
                    for bx in range(rng.choice((2, 3, 4))):
                        r = rng.choice(book_cols)
                        h = rng.choice((5, 6))
                        for yy in range(sy - 1 - h, sy - 1):
                            c.px(x, yy, r[2] if yy > sy - 1 - h else r[1])
                        c.px(x, sy - 3, BRASS[3])
                        x += 1
                    x += 1
                else:
                    blob(c, x + 2, sy - 3.2, 2.4, 2.2, rng.choice(glass)[:3])
                    c.px(x + 1, sy - 6, DW[3]); c.px(x + 2, sy - 6, DW[3]); c.px(x + 3, sy - 6, DW[2])
                    x += 6
            else:
                if rng.random() < 0.5 and x < 23:
                    for xx in range(x, x + 5):  # rolled scroll
                        c.px(xx, sy - 3, hx("f4ecd2")); c.px(xx, sy - 2, hx("cfc0a0"))
                    c.px(x + 1, sy - 3, CLOTH[2]); c.px(x + 3, sy - 3, CLOTH[2])
                    x += 6
                else:
                    g = rng.choice(glass)
                    bottle(c, x, sy - 1, g); x += 4
    rect(c, 1, 29, 30, 2, DW[0])
    c.outline()
    return c


def weapon_rack():
    c = Canvas(32, 32)
    blade = METAL[2:]
    for y in range(6, 30):
        c.px(3, y, DW[4]); c.px(4, y, DW[2]); c.px(27, y, DW[3]); c.px(28, y, DW[1])
    for x in range(3, 29):
        c.px(x, 7, DW[4]); c.px(x, 8, DW[2]); c.px(x, 22, DW[4]); c.px(x, 23, DW[2])
    for y in range(3, 20):  # sword
        c.px(8, y, blade[2]); c.px(9, y, blade[0])
    c.px(8, 2, blade[1])
    for x in range(6, 12):
        c.px(x, 19, BRASS[2] if x < 9 else BRASS[1])
    for y in range(20, 24):
        c.px(8, y, DW[2]); c.px(9, y, DW[1])
    c.px(8, 24, BRASS[3]); c.px(9, 24, BRASS[2])
    for y in range(4, 27):  # axe
        c.px(15, y, DW[4]); c.px(16, y, DW[2])
    for y in range(5, 12):
        w = 4 if 6 <= y <= 10 else 2
        for x in range(17, 17 + w):
            c.px(x, y, blade[2] if x == 16 + w else blade[1] if y < 8 else blade[0])
    for y in range(3, 28):  # spear
        c.px(22, y, DW[4]); c.px(23, y, DW[2])
    for y, w in ((0, 0), (1, 1), (2, 1), (3, 1), (4, 0)):
        for x in range(22 - w, 24 + w):
            c.px(x, y, blade[2] if x <= 22 else blade[1])
    for x in range(3, 29):
        c.px(x, 29, DW[1]); c.px(x, 30, DW[0])
    c.outline()
    return c


def plant():
    c = Canvas(T, 32)
    leaf = ramp("1e4a24", "2f7036", "4f9a44", "86c45e")
    for cx, cy, rx, ry in ((8, 15, 5.6, 5.0), (5, 11, 3.4, 3.2), (11, 11, 3.4, 3.2), (8, 7, 3.6, 3.4), (8, 18, 4.6, 2.6)):
        blob(c, cx, cy, rx, ry, leaf)
    for x, y in ((6, 9), (10, 9), (8, 13), (5, 15), (11, 15)):
        c.px(x, y, leaf[1])
    for y in range(21, 31):
        hw = 4 if y < 23 else 3
        for x in range(8 - hw, 8 + hw):
            col = TERRA[3] if x <= 8 - hw else TERRA[0] if x >= 8 + hw - 1 else TERRA[2]
            if y == 21:
                col = TERRA[3] if x < 8 + hw - 1 else TERRA[1]
            if y == 23:
                col = TERRA[1]
            c.px(x, y, col)
    c.outline()
    return c


def rug():
    c = Canvas(48, 32)
    field, field_lo, trim, edge_c = CLOTH[2], CLOTH[1], BRASS[2], CLOTH[0]
    for y in range(2, 30):
        for x in range(2, 46):
            if x in (2, 45) or y in (2, 29):
                col = edge_c
            elif x in (4, 43) or y in (4, 27):
                col = trim
            else:
                col = field
                dx, dy = abs(x - 23.5), abs(y - 15.5)
                if dx / 9 + dy / 7 < 1:
                    col = hx("2a3a6a") if dx / 9 + dy / 7 > 0.7 else trim if dx / 9 + dy / 7 > 0.45 else CLOTH[3]
                elif (x + y) % 6 == 0 or (x - y) % 6 == 0:
                    col = field_lo
            c.px(x, y, col)
    for y in range(3, 29, 2):  # fringe
        c.px(1, y, hx("ece0c0")); c.px(46, y, hx("ece0c0"))
    return c


def door_mat():
    c = Canvas(48, T)
    braid = ramp("5a3a1c", "8a5e2e", "b8864a", "d8aa6a")
    for y in range(T):
        for x in range(48):
            nx, ny = (x + 0.5 - 24) / 22, (y + 0.5 - 8) / 6
            d = nx * nx + ny * ny
            if d > 1:
                continue
            ring = int(d * 4)
            col = braid[2] if ring % 2 == 0 else braid[1]
            if (x + y) % 3 == 0:
                col = braid[3] if ring % 2 == 0 else braid[0]
            c.px(x, y, col)
    c.outline()
    return c


def person(tunic, apron, hair, beard=False):
    """16x24 front-facing townsperson."""
    c = Canvas(T, 24)
    sk = ramp("c88458", "eab088", "f8d6b2")
    for x in range(5, 11):
        for y in range(18, 21):
            c.px(x, y, hx("3a2a22") if x in (7, 10) else hx("4e3a2e"))
        c.px(x, 21, hx("24160e"))
    for y in range(11, 18):
        for x in range(4, 12):
            c.px(x, y, tunic[2] if x == 4 else tunic[0] if x >= 10 else tunic[1])
    for y in range(12, 17):
        c.px(3, y, tunic[1]); c.px(12, y, tunic[0])
    c.px(3, 17, sk[1]); c.px(12, 17, sk[0])
    for y in range(13, 18):
        for x in range(5, 11):
            c.px(x, y, apron[2] if x == 5 else apron[0] if x == 10 else apron[1])
    for x in range(4, 12):
        c.px(x, 13, DW[1])  # belt
    c.px(7, 13, BRASS[2])
    for y in range(4, 11):
        for x in range(4, 12):
            c.px(x, y, sk[2] if x == 4 else sk[0] if (x == 11 or y == 10) else sk[1])
    for y in range(1, 6):
        for x in range(4, 12):
            if y >= 5 and 7 <= x <= 8:
                continue
            c.px(x, y, hair[2] if (y <= 2 and 5 <= x <= 8) else hair[1])
    for y in range(3, 8):
        c.px(3, y, hair[1]); c.px(12, y, hair[0])
    for y in (7, 8):
        c.px(6, y, hx("2a1a20")); c.px(9, y, hx("2a1a20"))
    if beard:
        for x in range(5, 11):
            c.px(x, 10, hair[1])
        for x in (5, 10):
            c.px(x, 9, hair[1])
        c.px(7, 9, hair[0]); c.px(8, 9, hair[0])
    else:
        c.px(5, 9, hx("f0a090")); c.px(10, 9, hx("f0a090"))
    c.outline()
    c.shadows.append((8, 22.5, 5, 1.4, 90))
    return c


def merchant():
    return person(ramp("1e4a24", "2f7036", "4f9a44"), ramp("5a3418", "8a5a32", "b07a46"), ramp("3a2014", "5e3620", "8a5432"), beard=True)


# ------------------------------------------------------------------ preview

def label_sheet(pieces, scale=5):
    cols = 7
    cellw = 48 * scale + 24  # widest pieces (rug, door mat) are 48px
    rows = (len(pieces) + cols - 1) // cols
    W, H = cols * cellw + 24, rows * (32 * scale + 54) + 24
    sheet = Image.new("RGBA", (W, H), (236, 233, 226, 255))
    d = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=18)
    for i, (name, img) in enumerate(pieces):
        cx = 24 + (i % cols) * cellw
        cy = 24 + (i // cols) * (32 * scale + 54)
        bw = cellw - 24
        for y in range(0, 32 * scale, 10):
            for x in range(0, bw, 10):
                if (x // 10 + y // 10) % 2:
                    d.rectangle((cx + x, cy + y, cx + x + 9, cy + y + 9), fill=(224, 220, 212, 255))
        big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
        sheet.alpha_composite(big, (cx + (bw - big.width) // 2, cy + (32 * scale - big.height) // 2))
        tw = d.textlength(name, font=font)
        d.text((cx + (bw - tw) / 2, cy + 32 * scale + 8), name, font=font, fill=(52, 40, 32, 255))
    return sheet


def compose_room(img, props):
    W, H = 13, 10
    room = Image.new("RGBA", (W * T, H * T), VOID)

    def put(name, tx, ty, ox=0, oy=0, src=None):
        room.alpha_composite((src or img)[name], (tx * T + ox, ty * T + oy))

    for tx in range(1, 12):
        put("wall_upper", tx, 1)
        put("wall_lower", tx, 2)
        for ty in range(3, 9):
            put("floor_planks", tx, ty)
    room.alpha_composite(Image.new("RGBA", (11 * T, 3), (30, 18, 10, 90)), (T, 3 * T))
    glow = Image.new("RGBA", (64, 22), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((0, 0, 63, 21), fill=(255, 150, 60, 46))
    room.alpha_composite(glow, (6 * T + 16 - 32, 3 * T - 4))
    put("shield", 2, 1)
    put("window", 3, 1)
    put("wall_post", 4, 1)
    put("torch", 5, 1)
    put("fireplace", 6, 1)
    put("torch", 8, 1)
    put("wall_post", 9, 1)
    put("window", 10, 1)
    for ty in range(1, 9):
        put("edge_left", 1, ty)
        put("edge_right", 11, ty)
    for tx in range(1, 12):
        if tx not in (5, 6, 7):
            put("edge_bottom", tx, 8)
    put("edge_bl", 1, 8)
    put("edge_br", 11, 8)
    put("banner", 11, 1, ox=-2)
    put("potion_shelf", 1, 2)
    put("plant", 8, 2)
    put("weapon_rack", 9, 2)
    put("rug", 5, 5)
    put("door_mat", 5, 8)
    put("merchant", 2, 2, oy=14)
    put("counter_left", 1, 4)
    put("counter_mid", 2, 4)
    put("counter_right", 3, 4)
    put("ledger", 1, 4, oy=-5)
    put("scale", 3, 4, oy=-7)
    put("barrel", 11, 4, ox=-4, oy=-7, src=props)
    put("barrel", 11, 5, ox=-4, oy=-7, src=props)
    put("crate", 10, 7, ox=-4, oy=-5, src=props)
    put("sack", 11, 7, ox=-5, oy=-6, src=props)
    return room


def main():
    if OUT.exists():
        for f in OUT.glob("*.png"):
            f.unlink()
    OUT.mkdir(parents=True, exist_ok=True)
    makers = [
        ("floor_planks", floor_planks), ("floor_stone", floor_stone),
        ("wall_upper", wall_upper), ("wall_lower", wall_lower), ("wall_post", wall_post),
        ("window", window), ("torch", torch), ("shield", shield), ("banner", banner), ("fireplace", fireplace),
        ("edge_left", lambda: edge("left")), ("edge_right", lambda: edge("right")),
        ("edge_bottom", lambda: edge("bottom")), ("edge_bl", lambda: edge("bl")), ("edge_br", lambda: edge("br")),
        ("counter_left", lambda: counter("left")), ("counter_mid", lambda: counter("mid")),
        ("counter_right", lambda: counter("right")), ("scale", scale), ("ledger", ledger),
        ("potion_shelf", potion_shelf), ("weapon_rack", weapon_rack), ("plant", plant),
        ("rug", rug), ("door_mat", door_mat), ("merchant", merchant),
    ]
    img = {}
    for name, make in makers:
        im = make().image()
        im.save(OUT / f"{name}.png")
        img[name] = im
    props = {"barrel": sprite(barrel), "crate": sprite(crate), "sack": sprite(sack)}
    label_sheet([(n, img[n]) for n, _ in makers]).save(OUT / "tiles_preview.png")
    room = compose_room(img, props)
    room.resize((room.width * 5, room.height * 5), Image.NEAREST).save(OUT / "room_preview.png")
    print("wrote", len(makers), "pieces + 2 previews to", OUT)


if __name__ == "__main__":
    main()
