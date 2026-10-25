#!/usr/bin/env python3
"""Coastline + pirate port tileset (Gen-3 style, original art).

16x16 tiles: animated sea (2 frames), sand, shoreline edges / tips / bays (all
generated from one depth field so neighbours line up), docks and a stone quay.
Props: pirate ship, sloop, rowboat, lighthouse, harbor tavern, palm, cannon,
anchor, buoy, chest, rope coil, bollard, crab, seagull (+ the market barrel,
crate and sack). Writes PNGs to out/coast plus a tile sheet and a sample port.

    python3 tools/pixelgen/coast.py
"""
import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from interior import BRASS, DW, METAL, STONE, h2  # noqa: E402
from market import barrel, crate, sack  # noqa: E402
from pixel import Canvas, blob, hx, line, mix, poly, preview, ramp, rect  # noqa: E402

OUT = Path(__file__).resolve().parent / "out" / "coast"
T = 16

SEA = ramp("1d5596", "2873bd", "3a92da", "6fc2f2", "d2f0ff")
SHALLOW = hx("5ccbd8")
SAND = ramp("b58848", "d6ae6c", "ebcd92", "f7e6bc")
WET = ramp("8f7244", "ad9060", "c4a876")
FOAM, FOAM2 = hx("f6fcff"), hx("c6ecfa")
SAIL = ramp("a89a7e", "d2c6aa", "ece2cc", "fbf6ea")
RED = ramp("7a1a1e", "b02a2c", "dc4a40", "f07a68")
HULL = ramp("2a1610", "4a2a18", "6b4226", "8a5a32", "a8743f")
PLANK = ramp("3a2414", "5a3a22", "7c5232", "a06e46", "c48e5c")
ROPE = ramp("6a4c24", "9a7640", "c8a462")
LEAF = ramp("1a4a22", "2a7232", "48a040", "8ad060")
TRUNK = ramp("5a3c20", "7e5a34", "a07e4c")
SLATE = ramp("23304e", "34497a", "4a66a0", "7290c8")
WHITE, BLACK, GLOW = hx("ffffff"), hx("16141c"), hx("ffd664")


# -------------------------------------------------------------- ground tiles

def sea_px(x, y, f=0):
    """Tileable sea colour; waves shift one pixel per frame."""
    x, y = x % 16, y % 16
    col = SEA[2] if h2(x, y, 31) > 0.12 else SEA[1]
    for wx, wy, ln in ((2, 3, 4), (10, 7, 5), (5, 12, 3), (13, 14, 3)):
        dx = (x - wx - f) % 16
        if y == wy and dx < ln:
            col = SEA[4] if dx == ln // 2 else SEA[3]
        elif y == wy + 1 and 0 < dx < ln - 1:
            col = SEA[1]
    return col


def sand_px(x, y):
    x, y = x % 16, y % 16
    if (x, y) in ((4, 11), (12, 3)):
        return hx("f2d6cc")  # a shell
    r = h2(x, y, 41)
    return SAND[1] if r < 0.08 else SAND[3] if r > 0.93 else SAND[2]


def tile(fn):
    c = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            c.px(x, y, fn(x, y))
    return c


def wob(t):
    return round(math.sin(t / 16 * 2 * math.pi) * 1.2)


EDGE = {  # signed water depth for each side (positive = water)
    "s": lambda x, y: y - (9 + wob(x)),
    "n": lambda x, y: (6 - wob(x)) - y,
    "e": lambda x, y: x - (9 + wob(y)),
    "w": lambda x, y: (6 - wob(y)) - x,
}


def shore(depth, f=0):
    def px(x, y):
        d = depth(x, y)
        if d >= 3:
            return sea_px(x, y, f)
        if d >= 1:
            return mix(sea_px(x, y, f), SHALLOW, 0.5)
        if d >= 0:
            return FOAM if (x + y + f) % 3 else FOAM2
        if d >= -2:
            return WET[1] if d >= -1 else WET[2]
        return sand_px(x, y)
    return tile(px)


def shore_tiles():
    """edge_X: water on side X.  tip_XY: water on two sides (land juts out).
    bay_XY: water only in that corner (land curves in)."""
    out = {}
    for f in (0, 1):
        for k, fn in EDGE.items():
            out[f"edge_{k}_{f}"] = shore(fn, f)
        for a, b in (("s", "e"), ("s", "w"), ("n", "e"), ("n", "w")):
            out[f"tip_{a}{b}_{f}"] = shore(lambda x, y, a=a, b=b: max(EDGE[a](x, y), EDGE[b](x, y)), f)
            out[f"bay_{a}{b}_{f}"] = shore(lambda x, y, a=a, b=b: min(EDGE[a](x, y), EDGE[b](x, y)), f)
    return out


def dock():
    c = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            k = x % 4
            col = PLANK[1] if k == 3 else PLANK[4] if k == 0 else PLANK[3]
            if k != 3 and (y + (x // 4) * 5) % 8 == 7:
                col = PLANK[1]  # staggered board ends
            elif k in (1, 2) and h2(x, y, 51) < 0.08:
                col = PLANK[2]
            c.px(x, y, col)
    for x, y in ((1, 1), (5, 6), (9, 3), (13, 8), (1, 9), (9, 11)):
        c.px(x, y, METAL[2])
    return c


def dock_edge_s():
    """Pier end: boards, the side face, and posts going into the water."""
    c = dock()
    for y in range(10, 16):
        for x in range(T):
            c.p[y][x] = None
    for x in range(T):
        c.px(x, 10, PLANK[2]); c.px(x, 11, PLANK[1]); c.px(x, 12, PLANK[0])
    for x0 in (2, 12):
        for y in (13, 14):
            c.px(x0, y, PLANK[1]); c.px(x0 + 1, y, PLANK[0])
        c.px(x0 - 1, 15, FOAM); c.px(x0 + 2, 15, FOAM)
    return c


def dock_side(side):
    c = dock()
    xs = (13, 14, 15) if side == "e" else (2, 1, 0)
    for y in range(T):
        for i, x in enumerate(xs):
            c.px(x, y, (PLANK[2], PLANK[1], PLANK[0])[i])
    return c


def quay_top():
    c = Canvas(T, T)
    stones = [(0, 0, 7, 5), (9, 0, 14, 7), (0, 7, 5, 14), (7, 9, 14, 14), (7, 7, 7, 7)]
    for y in range(T):
        for x in range(T):
            c.px(x, y, hx("4a4450"))
    for n, (x0, y0, x1, y1) in enumerate(stones):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                col = STONE[4] if (x == x0 or y == y0) else STONE[2] if (x == x1 or y == y1) else STONE[3]
                if col == STONE[3] and h2(x, y, n + 9) < 0.08:
                    col = STONE[2]
                c.px(x, y, col)
    return c


def quay_face():
    """Harbor wall face, drawn over the top row of water under the quay."""
    c = Canvas(T, T)
    for x in range(T):
        c.px(x, 0, STONE[4]); c.px(x, 1, STONE[3])
        for y in range(2, 12):
            bx, by = (x + ((y - 2) // 4 % 2) * 4) % 8, (y - 2) % 4
            c.px(x, y, hx("3a3640") if by == 3 or bx == 7 else STONE[2] if by else STONE[3])
        c.px(x, 12, hx("2e3a34")); c.px(x, 13, hx("2a4a3a") if x % 3 else hx("3a6a4a"))
        if x % 4 == 1:
            c.px(x, 14, hx("3a6a4a"))
    return c


# --------------------------------------------------------------------- ships

def pirate_ship():
    c = Canvas(96, 80)
    hull = [(6, 44), (28, 44), (30, 48), (84, 48), (93, 40), (91, 52), (81, 64), (20, 66), (8, 58)]
    for x0, top, x1 in ((46, 3, 47), (70, 12, 71)):  # masts (behind the sails)
        for y in range(top, 49):
            c.px(x0, y, HULL[4]); c.px(x1, y, HULL[2])
    poly(c, [(72.5, 15), (95, 36), (79, 44)], SAIL[1])  # jib
    poly(c, [(73.5, 18), (92, 36), (80, 42)], SAIL[2])
    for y, x0, x1 in ((10, 33, 60), (24, 30, 63), (18, 59, 82), (30, 56, 85)):  # yards
        for x in range(x0, x1 + 1):
            c.px(x, y, HULL[2])
    sails = [[(35, 11), (58, 11), (60, 23), (33, 23)], [(32, 25), (61, 25), (64, 41), (29, 41)],
             [(61, 19), (80, 19), (82, 29), (59, 29)], [(58, 31), (83, 31), (86, 43), (55, 43)]]
    for pts in sails:
        x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
        y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
        poly(c, pts, SAIL[2])
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                if c.get(x, y) != SAIL[2]:
                    continue
                t, v = (x - x0) / (x1 - x0), (y - y0) / (y1 - y0)
                col = SAIL[3] if (t < 0.38 and v < 0.7) else SAIL[1] if (t > 0.86 or v > 0.88) else SAIL[2]
                if y - int(y0) == int((y1 - y0) * 0.45) and x % 2:
                    col = SAIL[1]  # one row of reef points
                c.px(x, y, col)
    rect(c, 40, 30, 4, 3, SAIL[1]); c.px(40, 30, SAIL[0]); c.px(43, 32, SAIL[0])  # patch
    for y in range(8, 11):  # crow's nest
        for x in range(43, 51):
            c.px(x, y, HULL[3] if y == 8 else HULL[1])
    poly(c, hull, HULL[2])
    for y in range(40, 67):
        for x in range(4, 95):
            col = c.get(x, y)
            if col != HULL[2]:
                continue
            if y <= 50:
                c.px(x, y, HULL[3])
            elif y >= 61:
                c.px(x, y, HULL[1])
            elif y % 3 == 0:
                c.px(x, y, HULL[1])
            if y in (53, 54):
                c.px(x, y, BRASS[2] if y == 53 else BRASS[1])
    for x in range(30, 72, 10):  # gun ports
        rect(c, x, 56, 4, 3, BRASS[1]); rect(c, x + 1, 57, 2, 1, BLACK)
    for x in range(30, 86):  # deck rail
        c.px(x, 47, HULL[4])
        if x % 4 == 0:
            c.px(x, 46, HULL[3]); c.px(x, 45, HULL[4])
    rect(c, 8, 34, 21, 12, HULL[3])  # stern cabin
    for x in range(7, 30):
        c.px(x, 33, HULL[4]); c.px(x, 34, HULL[2])
    for wx in (12, 21):
        rect(c, wx, 37, 4, 4, GLOW); c.px(wx, 37, hx("fff2b8")); rect(c, wx + 1, 37, 1, 4, HULL[1])
    c.px(6, 30, BRASS[3]); rect(c, 5, 31, 3, 2, GLOW)
    for x0, y0 in ((48, 1),):  # jolly roger
        rect(c, x0, y0, 11, 7, BLACK)
        for px_, py_ in ((52, 2), (53, 2), (54, 2), (51, 3), (52, 3), (53, 3), (54, 3), (55, 3), (52, 4), (54, 4),
                         (50, 6), (56, 6), (51, 5), (55, 5)):
            c.px(px_, py_, WHITE)
    c.px(47, 0, BRASS[3])
    line(c, 90, 42, 95, 35, HULL[3])  # bowsprit
    c.outline()
    for x in range(8, 92):  # foam where the hull meets the water
        col_bottom = max((y for y in range(40, 70) if c.get(x, y) not in (None,)), default=None)
        if col_bottom and col_bottom < 79 and x % 3:
            c.px(x, col_bottom + 1, FOAM if x % 5 else FOAM2)
    for (x0, y0), (x1, y1) in (((46, 3), (9, 33)), ((46, 3), (88, 41)), ((70, 12), (95, 35)), ((70, 12), (30, 44))):
        n = int(max(abs(x1 - x0), abs(y1 - y0)))
        for i in range(n + 1):  # rigging: thin, only over empty sky
            x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
            if c.get(x, y) is None:
                c.px(x, y, HULL[1])
    return c


def sloop():
    c = Canvas(48, 46)
    for y in range(4, 34):
        c.px(22, y, HULL[4]); c.px(23, y, HULL[2])
    poly(c, [(24.5, 5), (42, 31), (24.5, 32)], SAIL[2])
    for y in range(5, 33):
        for x in range(24, 43):
            if c.get(x, y) == SAIL[2] and ((y // 4) % 2):
                c.px(x, y, hx("3a7ad0") if x > 25 else hx("5a96e6"))
    poly(c, [(21.5, 8), (6, 30), (21.5, 30)], SAIL[3])
    poly(c, [(3, 33), (45, 33), (40, 42), (8, 42)], HULL[2])
    for x in range(3, 46):
        c.px(x, 33, HULL[4]); c.px(x, 34, HULL[3])
        if c.get(x, 40):
            c.px(x, 40, HULL[1]); c.px(x, 41, HULL[1])
    for x in range(8, 40):
        c.px(x, 37, hx("e8e0d0"))
    rect(c, 24, 1, 6, 4, hx("3a7ad0")); c.px(23, 0, BRASS[3])
    c.outline()
    for x in range(8, 41, 2):
        c.px(x, 44, FOAM)
    return c


def rowboat():
    """Small boat seen from above: pointed bow and stern, two seats, oars out."""
    c = Canvas(30, 18)
    line(c, 1, 3, 9, 7, PLANK[3]); line(c, 1, 14, 9, 10, PLANK[3])  # oars
    line(c, 28, 3, 20, 7, PLANK[3]); line(c, 28, 14, 20, 10, PLANK[3])
    poly(c, [(3, 9), (8, 4), (22, 4), (27, 9), (22, 14), (8, 14)], HULL[2])
    poly(c, [(5.5, 9), (9, 5.6), (21, 5.6), (24.5, 9), (21, 12.4), (9, 12.4)], PLANK[3])
    for x in range(9, 22):
        c.px(x, 5, HULL[4]); c.px(x, 13, HULL[1])
    for sx in (11, 18):
        for y in range(6, 12):
            c.px(sx, y, PLANK[1]); c.px(sx + 1, y, PLANK[2])
    for y in range(7, 11):
        c.px(14 if y % 2 else 15, y, PLANK[2])  # floor boards
    c.outline()
    return c


# --------------------------------------------------------------- buildings

def lighthouse():
    c = Canvas(32, 74)
    blob(c, 16, 66, 13, 6.5, STONE)
    for y in range(22, 62):
        hw = 5 + (y - 22) * 3 / 40
        stripe = ((y - 22) // 8) % 2
        for x in range(int(16 - hw), int(16 + hw) + 1):
            t = (x - (16 - hw)) / (2 * hw)
            r = RED if stripe else ramp("b8b2c0", "d8d4de", "f2f0f6", "ffffff")
            c.px(x, y, r[3] if t < 0.25 else r[1] if t > 0.78 else r[2])
    rect(c, 14, 53, 5, 8, hx("3a2418")); rect(c, 14, 53, 5, 1, hx("5a3a24"))
    for y in (36, 45):
        rect(c, 15, y, 2, 3, hx("2a3448"))
    for x in range(8, 25):
        c.px(x, 19, METAL[2]); c.px(x, 21, METAL[1])
        if x % 3 == 0:
            c.px(x, 20, METAL[2])
    for y in range(12, 19):
        for x in range(11, 22):
            c.px(x, y, METAL[1] if x in (11, 16, 21) else hx("fff2a8") if y < 15 else GLOW)
    for y in range(5, 12):
        hw = (y - 4) * 1.0
        for x in range(int(16 - hw), int(16 + hw) + 1):
            c.px(x, y, RED[3] if x < 15 else RED[1] if x > 18 else RED[2])
    c.px(16, 3, BRASS[2]); c.px(16, 4, BRASS[1])
    c.outline()
    for x, y in ((6, 14), (26, 14), (4, 16), (28, 16)):  # lamp glow
        c.px(x, y, hx("fff4c0"))
    return c


def tavern():
    """Harbor tavern: slate roof, timber and plaster over stone, anchor sign."""
    c = Canvas(64, 58)
    for y in range(0, 12):
        for x in range(46, 52):
            c.px(x, y, STONE[3] if x == 46 else STONE[1] if x == 51 else STONE[2])
    for y in range(4, 28):
        t = (y - 4) / 23
        x0, x1 = round(14 - 12 * t), round(49 + 12 * t)
        for x in range(x0, x1 + 1):
            row = (y - 4) // 3
            col = SLATE[2]
            if (y - 4) % 3 == 2:
                col = SLATE[0]
            elif (x + (row % 2) * 3) % 6 == 0:
                col = SLATE[1]
            elif y < 8:
                col = SLATE[3]
            c.px(x, y, col)
    for y in range(28, 44):  # plaster
        for x in range(6, 58):
            c.px(x, y, hx("ece2c8") if h2(x, y, 3) > 0.05 else hx("d8cbab"))
    for x in (6, 7, 22, 23, 40, 41, 56, 57):
        for y in range(28, 44):
            c.px(x, y, DW[3] if x % 2 == 0 else DW[1])
    for y in (28, 43):
        for x in range(6, 58):
            c.px(x, y, DW[4] if y == 28 else DW[1])
    for y in range(44, 58):  # stone base
        for x in range(6, 58):
            bx, by = (x + ((y - 44) // 4 % 2) * 4) % 8, (y - 44) % 4
            c.px(x, y, hx("3a3640") if by == 3 or bx == 7 else STONE[3] if by == 0 else STONE[2])
    for wx in (11, 45):
        rect(c, wx, 31, 8, 8, DW[1]); rect(c, wx + 1, 32, 6, 6, GLOW)
        c.px(wx + 1, 32, hx("fff2b8")); rect(c, wx + 4, 32, 1, 6, DW[1]); rect(c, wx + 1, 35, 6, 1, DW[1])
    rect(c, 27, 40, 10, 18, DW[1]); rect(c, 28, 41, 8, 17, DW[3])
    for y in range(41, 58):
        c.px(28, y, DW[4]); c.px(32, y, DW[2])
    c.px(34, 49, BRASS[3])
    for x in range(36, 46):  # sign bracket + anchor sign
        c.px(x, 31, METAL[1])
    rect(c, 39, 32, 8, 8, hx("e8dcc0")); rect(c, 39, 32, 8, 1, DW[2])
    for px_, py_ in ((43, 33), (42, 34), (43, 34), (44, 34), (43, 35), (43, 36), (41, 37), (45, 37), (42, 38), (43, 38), (44, 38)):
        c.px(px_, py_, hx("2a2a3a"))
    c.outline()
    return c


# ------------------------------------------------------------------- props

def palm():
    c = Canvas(34, 50)
    pts = [(14 + 5 * (t / 20) ** 1.5, 47 - 32 * t / 20) for t in range(21)]
    for i, (x, y) in enumerate(pts):
        for dx in (-1, 0, 1):
            col = TRUNK[2] if dx == -1 else TRUNK[0] if dx == 1 else TRUNK[1]
            if i % 3 == 0:
                col = TRUNK[0]
            c.px(x + dx, y, col); c.px(x + dx, y + 1, col)
    crown = (19, 14)
    for ang, length, droop in ((-170, 14, 7), (-130, 12, 9), (-60, 12, 9), (-15, 14, 7), (160, 11, 10), (30, 11, 10), (-95, 9, 4)):
        a = math.radians(ang)
        tip = (crown[0] + math.cos(a) * length, crown[1] + math.sin(a) * length * 0.55 + droop)
        ctrl = (crown[0] + math.cos(a) * length * 0.55, crown[1] + math.sin(a) * length * 0.55 - 3)
        for k in range(10):
            t = k / 9
            x = (1 - t) ** 2 * crown[0] + 2 * (1 - t) * t * ctrl[0] + t * t * tip[0]
            y = (1 - t) ** 2 * crown[1] + 2 * (1 - t) * t * ctrl[1] + t * t * tip[1]
            blob(c, x, y, 2.3 * (1 - t) + 0.7, 1.4 * (1 - t) + 0.6, LEAF)
    blob(c, 17.5, 16.5, 1.8, 1.8, TRUNK); blob(c, 20.5, 17, 1.8, 1.8, TRUNK)
    c.outline()
    c.shadows.append((15, 48, 8, 1.8, 90))
    return c


def cannon():
    c = Canvas(26, 18)
    blob(c, 13, 7, 9.5, 3.2, METAL[:4])
    rect(c, 21, 4, 2, 6, METAL[2]); c.px(22, 7, BLACK)
    for x in range(6, 19):
        for y in (10, 11):
            c.px(x, y, PLANK[3] if y == 10 else PLANK[1])
    for wx in (8, 16):
        blob(c, wx, 13, 2.4, 2.4, PLANK[:4]); c.px(wx, 13, METAL[1])
    for bx in (2, 4):
        blob(c, bx, 14.5, 1.4, 1.4, METAL[:3])
    c.outline()
    return c


def anchor():
    c = Canvas(18, 24)
    for y in range(3, 20):
        c.px(8, y, METAL[3]); c.px(9, y, METAL[1])
    for x in range(4, 14):
        c.px(x, 6, METAL[2])
    for p in ((8, 1), (9, 1), (7, 2), (10, 2), (8, 3), (9, 3)):
        c.px(*p, METAL[2])
    for i in range(6):
        c.px(3 + i, 15 + round(math.sqrt(max(0, 25 - (i - 5) ** 2)) * 0.8), METAL[2])
        c.px(14 - i, 15 + round(math.sqrt(max(0, 25 - (i - 5) ** 2)) * 0.8), METAL[1])
    for p in ((2, 14), (3, 13), (15, 14), (14, 13)):
        c.px(*p, METAL[3])
    for y in (9, 11):
        c.px(7, y, ROPE[2]); c.px(8, y, ROPE[1]); c.px(9, y, ROPE[1]); c.px(10, y, ROPE[0])
    c.outline()
    return c


def buoy():
    c = Canvas(16, 18)
    blob(c, 8, 9, 5.2, 5.6, RED)
    for y in range(4, 15):
        for x in range(2, 14):
            if c.get(x, y) and 7 <= y <= 9:
                c.px(x, y, hx("f4f0ea") if x < 9 else hx("c8c4cc"))
    rect(c, 7, 1, 2, 3, METAL[2])
    c.outline()
    for x in range(2, 15, 2):
        c.px(x, 16, FOAM)
    return c


def chest():
    c = Canvas(18, 16)
    blob(c, 9, 6, 7, 3.6, PLANK[1:])
    for y in range(7, 14):
        for x in range(2, 16):
            c.px(x, y, PLANK[3] if x < 9 else PLANK[2])
    for x in range(2, 16):
        c.px(x, 7, BRASS[2]); c.px(x, 13, PLANK[0])
    for y in range(3, 14):
        c.px(5, y, BRASS[1] if c.get(5, y) else None); c.px(12, y, BRASS[1] if c.get(12, y) else None)
    rect(c, 8, 8, 2, 3, BRASS[3]); c.px(8, 10, BLACK)
    for x in (4, 7, 10, 13):
        c.px(x, 6, BRASS[3])
    c.outline()
    return c


def rope_coil():
    c = Canvas(16, 12)
    for i, (rx, ry) in enumerate(((6.5, 4.4), (5.0, 3.3), (3.4, 2.2), (1.8, 1.2))):
        blob(c, 8, 6, rx, ry, [ROPE[1], ROPE[2], ROPE[2]] if i % 2 == 0 else [ROPE[0], ROPE[1], ROPE[1]])
    c.outline()
    return c


def bollard():
    c = Canvas(16, 16)
    for y in range(5, 14):
        for x in range(5, 11):
            c.px(x, y, PLANK[3] if x == 5 else PLANK[0] if x == 10 else PLANK[2])
    blob(c, 8, 4.5, 3.6, 1.8, PLANK[2:])
    for x in range(5, 11):
        c.px(x, 8, ROPE[2]); c.px(x, 9, ROPE[1])
    c.outline()
    return c


def crab():
    c = Canvas(18, 14)
    for x0, x1, y in ((3, 6, 9), (2, 5, 11), (12, 15, 9), (13, 16, 11)):
        line(c, x0, y, x1, y - 1, RED[1])
    blob(c, 9, 8, 4.6, 3.2, RED)
    blob(c, 3, 4, 1.9, 1.7, RED); blob(c, 15, 4, 1.9, 1.7, RED)
    for x in (7, 11):
        c.px(x, 4, WHITE); c.px(x, 5, RED[2]); c.px(x, 3, BLACK)
    c.outline()
    return c


def seagull():
    c = Canvas(18, 10)
    for i in range(7):
        y = 3 + abs(i - 3) // 2 if i < 4 else 3
        c.px(2 + i, 2 + round(abs(i - 3.5) * 0.6), hx("f4f4f8"))
        c.px(15 - i, 2 + round(abs(i - 3.5) * 0.6), hx("f4f4f8"))
    c.px(2, 4, hx("6a6a78")); c.px(15, 4, hx("6a6a78"))
    blob(c, 9, 5, 2.4, 1.6, ramp("b8b8c4", "e4e4ec", "ffffff"))
    c.px(11, 5, hx("f0a030"))
    c.outline()
    return c


# ------------------------------------------------------------------ output

def compose(tiles, props):
    W, H = 28, 18
    img = Image.new("RGBA", (W * T, H * T))

    def put(im, x, y):
        img.alpha_composite(im, (int(x), int(y)))

    for ty in range(H):
        for tx in range(W):
            quay = 8 <= tx <= 19
            if ty < 7 or (ty == 7 and not quay):
                put(tiles["sand"], tx * T, ty * T)
            elif ty in (7, 8) and quay:
                put(tiles["quay_top"], tx * T, ty * T)
            elif ty == 8:
                put(tiles["edge_s_0"], tx * T, ty * T)
            else:
                put(tiles["sea_0"], tx * T, ty * T)
    for tx in range(8, 20):
        put(tiles["quay_face"], tx * T, 9 * T)
    for ty in range(9, 15):
        put(tiles["dock_side_w"], 11 * T, ty * T); put(tiles["dock"], 12 * T, ty * T); put(tiles["dock_side_e"], 13 * T, ty * T)
    for tx in (11, 12, 13):
        put(tiles["dock_edge_s"], tx * T, 15 * T)

    def stand(name, cx, bottom):
        im = props[name]
        put(im, cx - im.width / 2, bottom - im.height)

    placed = [
        ("palm", 2.5, 6.6), ("palm", 6, 5.4), ("lighthouse", 24, 7.4), ("palm", 26.7, 6.9),
        ("tavern", 11, 6.6), ("barrel", 15.2, 6.7), ("crate", 16.4, 6.8), ("sack", 17.6, 6.7),
        ("chest", 4.2, 7.6), ("crab", 6.6, 8.2), ("cannon", 18.8, 8.6), ("bollard", 9.5, 9.1),
        ("bollard", 15.5, 9.1), ("rope_coil", 14.4, 8.7), ("barrel", 12.3, 11.6), ("crate", 11.6, 13.4),
        ("anchor", 21.6, 7.9),
    ]
    for name, x, y in sorted(placed, key=lambda p: p[2]):
        stand(name, x * T, y * T)
    put(props["pirate_ship"], 14 * T + 4, 9.6 * T)
    put(props["sloop"], 6 * T, 10.4 * T)
    put(props["rowboat"], 2 * T, 10.2 * T)
    put(props["buoy"], 23 * T, 12.2 * T)
    put(props["buoy"], 26 * T, 14.6 * T)
    put(props["seagull"], 21 * T, 10.6 * T)
    put(props["seagull"], 8.4 * T, 2.4 * T)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tiles = {"sea_0": tile(lambda x, y: sea_px(x, y, 0)), "sea_1": tile(lambda x, y: sea_px(x, y, 1)), "sand": tile(sand_px)}
    tiles.update(shore_tiles())
    tiles.update({"dock": dock(), "dock_edge_s": dock_edge_s(), "dock_side_e": dock_side("e"), "dock_side_w": dock_side("w"),
                  "quay_top": quay_top(), "quay_face": quay_face()})
    tiles = {k: v.image() for k, v in tiles.items()}
    makers = {"pirate_ship": pirate_ship, "sloop": sloop, "rowboat": rowboat, "lighthouse": lighthouse, "tavern": tavern,
              "palm": palm, "cannon": cannon, "anchor": anchor, "buoy": buoy, "chest": chest, "rope_coil": rope_coil,
              "bollard": bollard, "crab": crab, "seagull": seagull}
    props = {k: (fn() if k in ("pirate_ship", "sloop", "lighthouse", "buoy", "seagull") else _outlined(fn)).image() for k, fn in makers.items()}
    props.update({"barrel": _outlined(barrel).image(), "crate": _outlined(crate).image(), "sack": _outlined(sack).image()})
    for k, im in {**tiles, **props}.items():
        im.save(OUT / f"{k}.png")

    tile_groups = [("Sea", [tiles["sea_0"], tiles["sea_1"]]), ("Sand", [tiles["sand"]])]
    tile_groups += [(f"Edge {k.upper()}", [tiles[f"edge_{k}_0"]]) for k in "snew"]
    tile_groups += [(f"Tip {k.upper()}", [tiles[f"tip_{k}_0"]]) for k in ("se", "sw", "ne", "nw")]
    tile_groups += [(f"Bay {k.upper()}", [tiles[f"bay_{k}_0"]]) for k in ("se", "sw", "ne", "nw")]
    tile_groups += [("Dock", [tiles["dock"], tiles["dock_side_w"], tiles["dock_side_e"], tiles["dock_edge_s"]]),
                    ("Quay", [tiles["quay_top"], tiles["quay_face"]])]
    preview(tile_groups, scale=6, max_w=170, bg="checker").save(OUT / "tiles_preview.png")
    prop_groups = [(k.replace("_", " ").title(), [props[k]]) for k in
                   ("pirate_ship", "sloop", "rowboat", "lighthouse", "tavern", "palm", "cannon", "anchor", "buoy", "chest",
                    "rope_coil", "bollard", "crab", "seagull")]
    preview(prop_groups, scale=4, max_w=330, bg="checker").save(OUT / "props_preview.png")
    scene = compose(tiles, props)
    scene.resize((scene.width * 3, scene.height * 3), Image.NEAREST).save(OUT / "port_preview.png")
    print("wrote", len(tiles), "tiles +", len(props), "props + 3 previews to", OUT)


def _outlined(fn):
    c = fn()
    c.outline()
    return c


if __name__ == "__main__":
    main()
