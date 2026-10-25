#!/usr/bin/env python3
"""Equipment icons: one 24x24 pixel icon per item in game/items.js.

Every icon is drawn by hand-tuned code in the same style as the rest of the
tool (hue-shifted ramps, top-left light, coloured outline). The armory shows
them instead of a generic slot emoji. Writes out/items/<id>.png + a preview.

    python3 tools/pixelgen/items.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixel import Canvas, blob, clip_below, hx, line, mix, poly, preview, ramp, rect  # noqa: E402

OUT = Path(__file__).resolve().parent / "out" / "items"

STEEL = ramp("3a4250", "5e6878", "8c96a6", "bcc6d4", "eef2f8")
GOLD = ramp("6b4a12", "a8781e", "d9a934", "f5d36a", "fff2b0")
WOOD = ramp("3a2414", "5c3a22", "7d5232", "a06e46", "c48e5c")
LEATHER = ramp("3e2414", "62391e", "8a5530", "b07a46")
PURPLE = ramp("2b1745", "4b2873", "6f3ea6", "9a6bd1", "c8a8f0")
GREEN = ramp("1c4126", "2e6b34", "4f9b3f", "8cc95a")
DARK = ramp("16141c", "26232e", "3c3a48", "5a5868")
RED = ramp("5a1018", "9a2028", "d43a3a", "f07a6a")
CREAM = ramp("b8a888", "dccfb0", "f2e8d0", "fffaf0")
FIRE = ramp("8a1a0a", "d4421a", "f8902a", "ffd860", "fff6c8")
VOID = ramp("140a24", "2c1450", "5a2a9a", "9a6ae0", "e0c8ff")
SEA = ramp("0e3a4a", "1a6a7a", "2aa0a8", "6ad8d0", "d0fff6")
BLUE = ramp("1a2a6a", "2a4fb0", "4a7ad8", "8ab0f2", "e0ecff")
IVORY = ramp("a89a84", "d8cdb6", "f2ead8", "fffaf0")
ORANGE = ramp("7a3608", "c4650f", "f0952a", "ffd88a")
SKIN = ramp("c88458", "eab088", "f8d6b2")
WHITE, BLACK = hx("ffffff"), hx("16141c")


def icon(fn):
    def wrapped():
        c = Canvas(24, 24)
        fn(c)
        c.outline()
        return c
    wrapped.__name__ = fn.__name__
    return wrapped


def shade_x(c, x0, x1, rmp, y0=0, y1=23, only=None):
    """Recolour existing pixels across a span: lit on the left, shaded on the right."""
    n = len(rmp)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            col = c.get(x, y)
            if col is None or (only is not None and col not in only):
                continue
            t = (x - x0) / max(1, x1 - x0)
            c.px(x, y, rmp[max(0, min(n - 1, round((1 - t) * (n - 1) * 0.9)))])


def ring(c, cx, cy, r, w, col_light, col_dark):
    for y in range(24):
        for x in range(24):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r - w <= d <= r:
                c.px(x, y, col_light if (x + 0.5 - cx) + (y + 0.5 - cy) < 0 else col_dark)


# ------------------------------------------------------------------- blades

def diag_blade(c, x0, y0, length, rmp, curve=0.0):
    """45-degree blade from a base point up-right: lit top edge, dark bottom edge."""
    pts = []
    for i in range(length):
        x, y = x0 + i, y0 - i + round(curve * (i / max(1, length)) ** 2 * length * 0.35)
        pts.append((x, y))
        tip = i >= length - 2
        c.px(x, y, rmp[-1] if not tip else rmp[-2])
        c.px(x + 1, y, rmp[-2])
        if not tip:
            c.px(x + 1, y + 1, rmp[1])
    return pts


def hilt(c, gx, gy, guard, grip, pommel, guard_len=3):
    for k in range(-guard_len, guard_len + 1):  # cross-guard, perpendicular to the blade
        c.px(gx + k, gy + k, guard[-2] if k < 0 else guard[1])
        c.px(gx + k + 1, gy + k, guard[-1] if k < 0 else guard[2])
    for j in range(1, 5):  # grip
        c.px(gx - j, gy + j, grip[2] if j % 2 else grip[1]); c.px(gx - j + 1, gy + j, grip[1])
    blob(c, gx - 5.2, gy + 5.8, 1.5, 1.5, pommel[1:])


def sword(c, blade, guard=GOLD, grip=LEATHER, length=13, curve=0.0, pommel=GOLD):
    diag_blade(c, 9, 14, length, blade, curve)
    hilt(c, 8, 15, guard, grip, pommel)


# -------------------------------------------------------------------- heads

@icon
def iron_helm(c):
    blob(c, 11.5, 12, 7.2, 7.4, STEEL)
    clip_below(c, 19)
    for y in range(12, 14):
        for x in range(6, 18):
            c.px(x, y, BLACK)
    for y in range(12, 19):
        c.px(11, y, STEEL[4]); c.px(12, y, STEEL[2])
    for x, y in ((6, 15), (17, 15), (7, 9), (16, 9)):
        c.px(x, y, GOLD[3])
    blob(c, 11.5, 4.2, 2.2, 2.2, RED)
    for x, y in ((10, 2), (11, 1), (12, 1), (13, 2)):
        c.px(x, y, RED[3])


@icon
def wizard_hat(c):
    blob(c, 11.5, 17.5, 10.2, 2.8, PURPLE[:4])
    poly(c, [(14.5, 1), (18, 16), (5, 16)], PURPLE[2])
    shade_x(c, 5, 18, PURPLE[1:], 1, 16, only=[PURPLE[2]])
    for x in range(6, 18):
        c.px(x, 14, GOLD[2]); c.px(x, 15, GOLD[1])
    for x, y in ((11, 8), (10, 9), (11, 9), (12, 9), (11, 10)):
        c.px(x, y, GOLD[4] if (x, y) == (11, 9) else GOLD[3])


def _hood(c, rmp, inner):
    poly(c, [(2, 21), (21, 21), (19, 15), (4, 15)], rmp[1])
    blob(c, 11.5, 10.5, 7.6, 8.2, rmp)
    blob(c, 11.5, 12.5, 4.0, 4.6, [inner, inner, mix(inner, WHITE, 0.08)])
    shade_x(c, 2, 21, rmp, 15, 21, only=[rmp[1]])


@icon
def ranger_hood(c):
    _hood(c, GREEN, hx("16301a"))
    c.px(11, 3, GREEN[3]); c.px(10, 4, GREEN[3])


@icon
def rogue_hood(c):
    _hood(c, DARK[1:] + [hx("6a687a")], hx("0e0c14"))
    for y in (14, 15, 16):
        for x in range(8, 16):
            if c.get(x, y):
                c.px(x, y, hx("4a2a60") if y < 16 else hx("2e1a40"))


@icon
def chain_coif(c):
    blob(c, 11.5, 11, 7.8, 8.6, STEEL)
    for y in range(24):
        for x in range(24):
            col = c.get(x, y)
            if col in STEEL and (x + y) % 2 == 0:
                c.px(x, y, STEEL[max(0, STEEL.index(col) - 1)])
    blob(c, 11.5, 12.5, 3.8, 4.4, [hx("1a1620"), hx("2a2430"), hx("3a3440")])


def _crown(c, band, spikes, gem_cols, horn=False):
    for y in range(12, 18):
        for x in range(4, 20):
            c.px(x, y, band[3] if y == 12 else band[1] if y == 17 else band[2])
    for i, sx in enumerate((4, 8, 12, 16, 19) if not horn else (4, 19)):
        top = 6 if i % 2 == 0 else 8
        if horn:
            for k in range(7):
                c.px(sx + (-1 if sx < 12 else 1) * (k // 3), 11 - k, spikes[3] if k < 4 else spikes[2])
                c.px(sx + (-1 if sx < 12 else 1) * (k // 3) + (1 if sx < 12 else -1), 11 - k, spikes[1])
        else:
            for y in range(top, 12):
                w = (y - top) // 2
                for x in range(sx - w, sx + w + 1):
                    c.px(x, y, spikes[3] if x <= sx else spikes[1])
            blob(c, sx + 0.5, top - 0.6, 1.0, 1.0, spikes[1:])
    for gx, col in zip((7, 11, 15), gem_cols):
        rect(c, gx, 14, 2, 2, col); c.px(gx, 14, mix(col, WHITE, 0.5))


@icon
def gold_crown(c):
    _crown(c, GOLD, GOLD, [hx("d43a3a"), hx("3a7ad0"), hx("d43a3a")])


@icon
def dragon_crown(c):
    _crown(c, ramp("3a0a10", "6a1420", "9a2a2a", "c84a3a"), GOLD, [GOLD[3], hx("4fe06a"), GOLD[3]], horn=True)
    for x in (8, 12, 15):
        for y in range(8, 12):
            if y >= 12 - (2 if x == 12 else 1) * 2:
                c.px(x, y, GOLD[2])
    c.px(12, 15, BLACK); c.px(12, 14, hx("aaffb0"))


@icon
def pirate_tricorn(c):
    blob(c, 11.5, 9, 6.2, 4.4, DARK)
    poly(c, [(1, 12), (11.5, 6.5), (22, 12), (18.5, 15.5), (11.5, 19), (4.5, 15.5)], DARK[2])
    shade_x(c, 1, 22, DARK, 6, 19, only=[DARK[2]])
    for x, y in ((1, 12), (2, 12), (3, 13), (4, 14), (5, 15), (6, 16), (7, 16), (8, 17), (9, 17), (10, 18), (11, 18),
                 (12, 18), (13, 18), (14, 17), (15, 17), (16, 16), (17, 16), (18, 15), (19, 14), (20, 13), (21, 12)):
        c.px(x, y, GOLD[2] if x < 12 else GOLD[1])
    skull = ["..XXX..", ".XXXXX.", ".XBXBX.", "..XXX..", "..X.X.."]  # little skull on the front
    for j, row in enumerate(skull):
        for i, ch in enumerate(row):
            if ch != ".":
                c.px(8 + i, 9 + j, BLACK if ch == "B" else (IVORY[3] if i < 4 else IVORY[2]))


@icon
def horned_helm(c):
    for side in (-1, 1):  # ivory horns curling up from the sides
        for k in range(10):
            t = k / 9
            x = 11.5 + side * (6.5 + 3.5 * math.sin(t * 2.2))
            y = 12 - 10 * t
            blob(c, x, y, 2.0 * (1 - t) + 0.6, 1.4, IVORY[:3] if side > 0 else IVORY[1:])
    blob(c, 11.5, 13, 6.6, 6.8, STEEL)
    clip_below(c, 19)
    for x in range(5, 19):
        c.px(x, 13, GOLD[2]); c.px(x, 14, GOLD[1])
    for x in (7, 10, 13, 16):
        c.px(x, 13, GOLD[4])
    for y in range(14, 20):
        c.px(11, y, STEEL[4]); c.px(12, y, STEEL[2])


# --------------------------------------------------------------------- eyes

def _lens_pair(c, frame_l, frame_d, lens, r=3.6, y=12, gap=9):
    for cx in (11.5 - gap / 2, 11.5 + gap / 2):
        blob(c, cx, y, r - 0.6, r - 0.6, lens)
        ring(c, cx, y, r, 1.2, frame_l, frame_d)


@icon
def round_specs(c):
    _lens_pair(c, STEEL[3], STEEL[1], ramp("6a8ab0", "a8c8e8", "e0f0ff"))
    for x in (10, 11, 12, 13):
        c.px(x, 11, STEEL[2])
    line(c, 1, 11, 3, 11, STEEL[2]); line(c, 20, 11, 22, 11, STEEL[1])
    c.px(6, 10, WHITE); c.px(15, 10, WHITE)


@icon
def shadow_visor(c):
    poly(c, [(1, 9), (22, 9), (20, 15), (12.5, 13.5), (11, 13.5), (3, 15)], hx("1c1426"))
    for x in range(3, 21):
        c.px(x, 10, hx("8a3aa0") if x < 12 else hx("5a2a70"))
    for x in range(4, 9):
        c.px(x, 11, hx("e06ae8"))
    line(c, 0, 12, 1, 12, DARK[2]); line(c, 22, 12, 23, 12, DARK[1])


@icon
def mystic_monocle(c):
    blob(c, 11, 10, 4.6, 4.6, PURPLE[2:])
    ring(c, 11, 10, 5.8, 1.4, GOLD[3], GOLD[1])
    c.px(9, 8, WHITE); c.px(10, 8, PURPLE[4])
    for i in range(8):  # chain
        c.px(15 + i // 2 + (i % 2), 15 + i, GOLD[2] if i % 2 else GOLD[1])


@icon
def dragons_gaze(c):
    for x in range(1, 23):
        c.px(x, 12, hx("4a1a1a")); c.px(x, 13, hx("2e0e10"))
    for cx in (7.0, 16.0):
        blob(c, cx, 12.5, 4.0, 3.4, ramp("6a1a0a", "c84a1a", "f8a02a"))
        ring(c, cx, 12.5, 4.6, 1.2, GOLD[3], GOLD[1])
        for y in range(10, 16):
            c.px(int(cx), y, BLACK)
        c.px(int(cx) - 2, 11, FIRE[4])


@icon
def eyepatch(c):
    line(c, 0, 7, 23, 15, DARK[2])
    line(c, 0, 8, 23, 16, DARK[1])
    blob(c, 13, 12.5, 4.6, 3.8, DARK)
    c.px(11, 11, DARK[3]); c.px(12, 10, DARK[3])


@icon
def sun_goggles(c):
    for x in range(0, 24):
        c.px(x, 12, LEATHER[2]); c.px(x, 13, LEATHER[1])
    _lens_pair(c, GOLD[3], GOLD[1], ramp("8a4a0a", "e08a1a", "ffc860"), r=4.4, gap=10)
    c.px(5, 10, WHITE); c.px(15, 10, WHITE)
    rect(c, 11, 11, 2, 2, GOLD[2])


# --------------------------------------------------------------------- body

def _torso(c, rmp, sleeves="short", length=20, flare=0):
    pts = [(7, 3), (16, 3), (18, 5), (17 + flare, length), (6 - flare, length), (5, 5)]
    poly(c, pts, rmp[2])
    if sleeves != "none":
        reach = {"short": 10, "long": 15, "wide": 15}[sleeves]
        wide = 2 if sleeves == "wide" else 0
        poly(c, [(5, 4), (1 - wide, reach - 3), (3 - wide, reach + 1), (7, 9)], rmp[2])
        poly(c, [(18, 4), (22 + wide, reach - 3), (20 + wide, reach + 1), (16, 9)], rmp[2])
    shade_x(c, 0, 23, rmp, 0, 23, only=[rmp[2]])
    for x in range(9, 15):  # neckline
        c.px(x, 3, rmp[0])
    c.px(10, 4, rmp[0]); c.px(13, 4, rmp[0])


@icon
def steel_armor(c):
    _torso(c, STEEL, "short", 19)
    for y in range(5, 20):
        for x in (10, 11, 12, 13):
            c.px(x, y, RED[2] if x < 12 else RED[1])
    blob(c, 4.5, 5.5, 3.2, 2.6, STEEL); blob(c, 18.5, 5.5, 3.2, 2.6, STEEL)
    for x in range(6, 18):
        c.px(x, 16, LEATHER[1])
    c.px(11, 16, GOLD[3]); c.px(12, 16, GOLD[2]); c.px(11, 9, GOLD[3])


@icon
def mage_robe(c):
    _torso(c, PURPLE[:4], "wide", 22, flare=3)
    for y in range(4, 23):
        c.px(11, y, GOLD[3]); c.px(12, y, GOLD[2])
    for x in range(3, 21):
        if c.get(x, 22):
            c.px(x, 22, GOLD[2])
    for x in range(7, 17):
        c.px(x, 14, GOLD[1])


@icon
def ranger_tunic(c):
    _torso(c, GREEN, "long", 20)
    for x in range(6, 18):
        c.px(x, 14, LEATHER[2]); c.px(x, 15, LEATHER[1])
    c.px(11, 14, GOLD[3])
    for i in range(10):
        c.px(7 + i, 5 + i, LEATHER[2])


@icon
def rogue_tunic(c):
    _torso(c, DARK[1:] + [hx("6a687a")], "long", 20)
    for x in range(6, 18):
        c.px(x, 4, hx("6a3a80")); c.px(x, 5, hx("4a2a60"))
    for y in range(5, 10):
        c.px(7, y, hx("4a2a60"))
    for x in range(6, 18):
        c.px(x, 15, hx("2a2430"))
    rect(c, 15, 16, 3, 3, LEATHER[2])


@icon
def leather_vest(c):
    _torso(c, LEATHER, "none", 19)
    for y in range(3, 10):
        for x in range(10, 14):
            if abs(x - 11.5) < (10 - y) * 0.45:
                c.px(x, y, SKIN[1])
    for y in range(8, 17, 2):
        c.px(10, y, CREAM[2]); c.px(13, y, CREAM[2]); c.px(11, y + 1, CREAM[1]); c.px(12, y + 1, CREAM[1])


@icon
def phoenix_plate(c):
    _torso(c, FIRE[:4], "short", 19)
    for y in range(6, 18):
        for x in range(9, 15):
            if c.get(x, y) and abs(x - 11.5) < (18 - y) * 0.35:
                c.px(x, y, GOLD[3] if x < 12 else GOLD[2])
    for side in (-1, 1):  # flame wings on the shoulders
        for k in range(6):
            c.px(int(11.5 + side * (7 + k * 0.6)), 4 - k // 2, FIRE[3] if k % 2 else FIRE[2])
            c.px(int(11.5 + side * (7 + k * 0.6)), 5 - k // 2, FIRE[1])
    c.px(11, 9, FIRE[4]); c.px(12, 9, FIRE[3])


@icon
def chainmail(c):
    _torso(c, STEEL, "long", 20)
    for y in range(24):
        for x in range(24):
            col = c.get(x, y)
            if col in STEEL and (x + y) % 2 == 0:
                c.px(x, y, STEEL[max(0, STEEL.index(col) - 1)])
    for x in range(6, 18):
        c.px(x, 15, LEATHER[1])


@icon
def pirate_coat(c):
    _torso(c, RED, "long", 22, flare=2)
    for y in range(3, 10):  # cream lapels
        c.px(9 + (y - 3) // 3, y, CREAM[3]); c.px(14 - (y - 3) // 3, y, CREAM[2])
    for y in (8, 11, 14, 17):
        c.px(9, y, GOLD[3]); c.px(14, y, GOLD[2])
    for x in range(5, 19):
        c.px(x, 13, BLACK)
    rect(c, 11, 12, 2, 3, GOLD[3])
    for x, y in ((1, 12), (2, 12), (21, 12), (22, 12), (1, 13), (22, 13)):
        c.px(x, y, CREAM[3])


# ----------------------------------------------------------------- weapons

@icon
def iron_sword(c):
    sword(c, STEEL[1:])


@icon
def ember_blade(c):
    sword(c, FIRE[1:], guard=ramp("3a1a10", "6a2a14", "a8401a", "e8702a", "ffb060"))
    for x, y in ((22, 6), (18, 2), (21, 10), (15, 4)):
        c.px(x, y, FIRE[3])


@icon
def void_blade(c):
    sword(c, VOID[1:], guard=DARK + [VOID[3]], grip=DARK, pommel=VOID)
    for x, y in ((22, 2), (19, 0), (23, 5)):
        c.px(x, y, VOID[4])


@icon
def shadow_dagger(c):
    diag_blade(c, 11, 12, 8, ramp("2a2a44", "4a4a6a", "8d93c4", "dfe3ff"))
    hilt(c, 10, 13, DARK, LEATHER, DARK, guard_len=2)


@icon
def oak_staff(c):
    for i in range(16):
        x, y = 3 + i, 21 - i
        c.px(x, y, WOOD[3]); c.px(x + 1, y, WOOD[2]); c.px(x + 1, y + 1, WOOD[1])
    for k in (4, 9):
        c.px(3 + k, 21 - k, LEATHER[3]); c.px(4 + k, 21 - k, LEATHER[2])
    blob(c, 19, 5, 3.6, 3.6, BLUE)
    c.px(17, 3, WHITE)
    for x, y in ((22, 1), (15, 2), (23, 8)):
        c.px(x, y, hx("9fe6ff"))


def _bow(c, limb, recurve=False):
    for y in range(1, 23):
        k = abs(y - 11.5)
        x = 16 - round(k * k / 13)
        c.px(x, y, limb[2]); c.px(x + 1, y, limb[1])
    if recurve:
        for y, dx in ((1, 1), (2, 2), (21, 2), (22, 1)):
            c.px(16 - round(10.5 ** 2 / 13) - dx, y, limb[3])
        for y in (1, 22):
            c.px(6, y, STEEL[3])
    for y in range(2, 22):
        c.px(6, y, CREAM[2])
    for y in range(10, 14):
        c.px(16, y, LEATHER[2]); c.px(17, y, LEATHER[1])


@icon
def hunter_bow(c):
    _bow(c, WOOD[1:])
    for x in range(6, 21):  # nocked arrow
        c.px(x, 12, WOOD[3])
    c.px(21, 12, STEEL[3]); c.px(20, 11, STEEL[2]); c.px(20, 13, STEEL[2])
    c.px(7, 11, RED[2]); c.px(7, 13, RED[2])


@icon
def composite_bow(c):
    _bow(c, ramp("2a1810", "4a2a1a", "6a3e26", "c8a060"), recurve=True)


@icon
def cutlass(c):
    diag_blade(c, 9, 14, 12, STEEL[1:], curve=1.2)
    hilt(c, 8, 15, GOLD, LEATHER, GOLD, guard_len=2)
    for k in range(5):  # basket guard
        c.px(4 + k, 13 + (k * k) // 6, GOLD[2]); c.px(4 + k, 14 + (k * k) // 6, GOLD[1])


@icon
def trident(c):
    shaft = ramp("0e3a4a", "1a6a7a", "2aa0a8", "6ad8d0")
    for i in range(14):
        x, y = 3 + i, 21 - i
        c.px(x, y, shaft[2]); c.px(x + 1, y, shaft[1])
    for k in range(-3, 4):  # crossbar
        c.px(16 + k, 8 + k, GOLD[2]); c.px(17 + k, 8 + k, GOLD[1])
    for bx, by in ((13, 5), (17, 8), (21, 11)):  # three prongs
        for j in range(5):
            c.px(bx + j - 2 + 2, by - j - 2 + 2 - 2, GOLD[3] if j < 4 else GOLD[4])
            c.px(bx + j - 2 + 3, by - j - 2 + 2 - 2, GOLD[1])
    c.px(21, 1, GOLD[4]); c.px(23, 5, GOLD[4])


# -------------------------------------------------------------- off-hands

@icon
def wooden_shield(c):
    blob(c, 11.5, 11.5, 9.0, 9.4, WOOD[1:])
    for y in range(24):
        for x in range(24):
            if c.get(x, y) and (x - 3) % 5 == 4:
                c.px(x, y, WOOD[1])
    ring(c, 11.5, 11.5, 9.4, 1.4, STEEL[3], STEEL[1])
    blob(c, 11.5, 11.5, 2.2, 2.2, STEEL[1:])


@icon
def iron_buckler(c):
    blob(c, 11.5, 11.5, 7.4, 7.4, STEEL)
    ring(c, 11.5, 11.5, 5.0, 1.0, STEEL[1], STEEL[3])
    blob(c, 11.5, 11.5, 2.0, 2.0, GOLD[1:])


@icon
def tower_shield(c):
    for y in range(1, 23):
        for x in range(4, 20):
            if (y < 3 and x in (4, 19)) or (y > 20 and x in (4, 19)):
                continue
            c.px(x, y, STEEL[3] if x < 6 else STEEL[1] if x > 17 else hx("2e4a8a") if 6 < x < 17 and 2 < y < 21 else STEEL[2])
    for y in range(5, 18):
        c.px(11, y, GOLD[3]); c.px(12, y, GOLD[2])
    for x in range(8, 16):
        c.px(x, 9, GOLD[3] if x < 12 else GOLD[2])


@icon
def aegis(c):
    poly(c, [(3, 2), (20, 2), (20, 11), (11.5, 22), (3, 11)], GOLD[2])
    poly(c, [(5, 4), (18, 4), (18, 11), (11.5, 19.5), (5, 11)], BLUE[2])
    shade_x(c, 5, 18, BLUE[1:4], 4, 20, only=[BLUE[2]])
    shade_x(c, 3, 20, GOLD[1:4], 2, 22, only=[GOLD[2]])
    blob(c, 11.5, 10, 3.0, 3.0, GOLD[2:])
    for a in range(8):
        ang = a * math.pi / 4
        c.px(round(11.5 + math.cos(ang) * 4.6), round(10 + math.sin(ang) * 4.6), GOLD[4])


@icon
def tome_of_sparks(c):
    for y in range(3, 21):
        for x in range(5, 19):
            c.px(x, y, PURPLE[2] if x > 6 else PURPLE[3])
    for y in range(4, 20):
        c.px(18, y, CREAM[2]); c.px(19, y, CREAM[1])
    for x, y in ((5, 3), (6, 3), (5, 4), (17, 3), (18, 3), (5, 20), (6, 20), (5, 19)):
        c.px(x, y, GOLD[3])
    for x, y in ((13, 6), (12, 7), (11, 8), (10, 9), (11, 10), (12, 10), (13, 10), (12, 11), (11, 12), (10, 13), (9, 14)):
        c.px(x, y, hx("ffe060"))
    c.px(14, 6, hx("fff6b0"))


@icon
def lantern(c):
    ring(c, 11.5, 3.5, 2.6, 1.0, STEEL[3], STEEL[1])
    for x in range(7, 17):
        c.px(x, 6, STEEL[2]); c.px(x, 19, STEEL[1]); c.px(x, 20, STEEL[0])
    for y in range(7, 19):
        for x in range(8, 16):
            c.px(x, y, hx("ffd664") if 9 < x < 14 else hx("e8a83a"))
        c.px(7, y, STEEL[3]); c.px(16, y, STEEL[1]); c.px(11, y, STEEL[2])
    blob(c, 11.5, 13, 1.6, 2.6, FIRE[2:])


@icon
def crystal_orb(c):
    blob(c, 11.5, 9.5, 7.0, 7.0, ramp("4a3a8a", "7a6ad0", "aab0f0", "e8eeff"))
    c.px(8, 6, WHITE); c.px(9, 5, WHITE); c.px(8, 7, hx("e8eeff"))
    for x in range(6, 18):
        c.px(x, 17, GOLD[3] if x < 12 else GOLD[2])
    for x in range(7, 17):
        c.px(x, 18, GOLD[2]); c.px(x, 19, GOLD[1])
    for x in range(5, 19):
        c.px(x, 20, GOLD[1])


@icon
def ships_compass(c):
    blob(c, 11.5, 12, 8.4, 8.4, GOLD)
    blob(c, 11.5, 12, 6.2, 6.2, ramp("c8c0a8", "ece4cc", "fffaf0"))
    for y in range(7, 12):
        c.px(11, y, RED[2]); c.px(12, y, RED[1])
    for y in range(12, 17):
        c.px(11, y, STEEL[3]); c.px(12, y, STEEL[2])
    c.px(11, 7, RED[3]); rect(c, 11, 2, 2, 2, GOLD[2])
    for x, y in ((11, 5), (5, 12), (18, 12), (11, 18)):
        c.px(x, y, DARK[1])


@icon
def captains_hook(c):
    for y in range(14, 22):
        for x in range(8, 16):
            c.px(x, y, LEATHER[2] if x < 12 else LEATHER[1])
    for x in range(8, 16):
        c.px(x, 14, GOLD[2]); c.px(x, 15, GOLD[1])
    for y in range(8, 14):
        c.px(11, y, STEEL[3]); c.px(12, y, STEEL[2])
    for k in range(9):  # the hook
        a = math.pi * (k / 8)
        c.px(round(11.5 - 4 * math.cos(a)) - 4 + 4, round(8 - 4 * math.sin(a)), STEEL[3] if k < 5 else STEEL[2])
        c.px(round(11.5 - 4 * math.cos(a)) - 4 + 5, round(8 - 4 * math.sin(a)), STEEL[1])
    c.px(7, 9, STEEL[4]); c.px(7, 10, STEEL[3])


# -------------------------------------------------------------------- feet

def _boot(c, ox, oy, rmp, sole, tall=12, cuff=None):
    top = 18 - tall
    for y in range(top, 17):
        for x in range(1, 6):
            c.px(ox + x, oy + y, rmp[2])
    for y in range(13, 17):
        for x in range(1, 10):
            if not (y == 13 and x > 7):
                c.px(ox + x, oy + y, rmp[2])
    shade_x(c, ox + 1, ox + 9, rmp, oy + top, oy + 16, only=[rmp[2]])
    for x in range(0, 10):
        c.px(ox + x, oy + 17, sole)
    if cuff:
        for x in range(0, 7):
            c.px(ox + x, oy + top, cuff[1]); c.px(ox + x, oy + top + 1, cuff[0])


def _pair(c, rmp, sole, tall=12, cuff=None):
    _boot(c, 9, -1, [mix(col, BLACK, 0.25) for col in rmp], sole, tall, cuff)
    _boot(c, 3, 4, rmp, sole, tall, cuff)


@icon
def leather_boots(c):
    _pair(c, LEATHER, hx("2a1810"), 10, cuff=[LEATHER[1], LEATHER[3]])


@icon
def swift_sandals(c):
    for ox, oy, dim in ((9, -1, 0.25), (3, 4, 0.0)):
        strap = [mix(col, BLACK, dim) for col in CREAM]
        for x in range(0, 10):  # sole
            c.px(ox + x, oy + 17, LEATHER[1]); c.px(ox + x, oy + 16, mix(LEATHER[3], BLACK, dim))
        for y in range(9, 16):  # ankle strap
            c.px(ox + 2, oy + y, strap[3]); c.px(ox + 3, oy + y, strap[1])
        for y in (10, 13):
            c.px(ox + 1, oy + y, strap[2]); c.px(ox + 4, oy + y, strap[1])
        for x in range(3, 9):  # toe strap
            c.px(ox + x, oy + 14, strap[2] if x < 6 else strap[1])


@icon
def iron_greaves(c):
    _pair(c, STEEL, DARK[1], 13)
    for ox, oy in ((9, -1), (3, 4)):
        blob(c, ox + 3.5, oy + 7.5, 2.4, 1.8, STEEL[2:])


@icon
def winged_boots(c):
    _pair(c, ramp("8a8270", "c8bfa8", "efe8d6", "ffffff"), hx("6a5a3a"), 10)
    feather = [hx("b8c8dc"), hx("e8f2ff"), WHITE]
    for ox, oy in ((9, -1), (3, 4)):  # three-feather wing at the ankle
        for f, (length, rise) in enumerate(((5, 4), (4, 2), (3, 0))):
            for k in range(length):
                c.px(ox - k, oy + 8 + f * 2 - (k * rise) // max(1, length), feather[2 - (k == length - 1)])
                c.px(ox - k, oy + 9 + f * 2 - (k * rise) // max(1, length), feather[0])


@icon
def dragons_stride(c):
    scale = ramp("3a0a10", "6a1420", "9a2a2a", "c84a3a")
    _pair(c, scale, GOLD[1], 11)
    for y in range(24):
        for x in range(24):
            if c.get(x, y) in scale and (x + 2 * y) % 4 == 0:
                c.px(x, y, scale[0])
    for ox, oy in ((9, -1), (3, 4)):
        c.px(ox + 10, oy + 16, GOLD[3]); c.px(ox + 10, oy + 15, GOLD[2])


@icon
def sea_boots(c):
    _pair(c, DARK[1:] + [hx("6a687a")], hx("0e0c12"), 14, cuff=[DARK[2], DARK[3]])
    for ox, oy in ((9, -1), (3, 4)):
        c.px(ox + 3, oy + 10, GOLD[3]); c.px(ox + 4, oy + 10, GOLD[2])


@icon
def shadow_treads(c):
    _pair(c, VOID[:4], hx("0a0614"), 11)
    for x, y in ((1, 20), (0, 18), (2, 22), (8, 14), (7, 12)):
        c.px(x, y, VOID[3])


# -------------------------------------------------------------------- pets

@icon
def baby_slime(c):
    blob(c, 11.5, 15.5, 7.6, 6.4, ramp("1e5a1e", "2f8a2c", "4fb848", "8ee070", "d8ffc0"))
    clip_below(c, 20)
    c.px(8, 12, WHITE); c.px(9, 11, hx("d8ffc0"))
    for ex in (8, 14):
        rect(c, ex, 15, 2, 2, BLACK); c.px(ex, 15, WHITE)


@icon
def forest_fox(c):
    for k in range(9):  # tail
        blob(c, 18 - k * 0.2, 19 - k * 1.2, 2.4, 1.8, ORANGE)
    blob(c, 18.6, 8.6, 1.6, 1.4, CREAM[1:])
    blob(c, 11, 16, 5.4, 5.0, ORANGE)
    blob(c, 11, 17.5, 2.6, 3.0, CREAM[1:])
    blob(c, 11, 8.5, 4.6, 3.8, ORANGE)
    poly(c, [(7, 7), (7.5, 2), (10, 5)], ORANGE[2]); poly(c, [(15, 7), (14.5, 2), (12, 5)], ORANGE[1])
    c.px(9, 8, BLACK); c.px(13, 8, BLACK); c.px(11, 10, BLACK)
    blob(c, 11, 10.5, 1.8, 1.0, CREAM[1:])


@icon
def ember_sprite(c):
    poly(c, [(11.5, 1), (17, 11), (15, 18), (8, 18), (6, 11)], FIRE[2])
    blob(c, 11.5, 13.5, 5.2, 5.4, FIRE[1:])
    blob(c, 11.5, 14.5, 3.0, 3.2, FIRE[2:])
    c.px(10, 13, BLACK); c.px(13, 13, BLACK); c.px(10, 12, WHITE)
    for x, y in ((4, 6), (19, 4), (18, 18), (5, 19)):
        c.px(x, y, FIRE[3])


@icon
def void_familiar(c):
    blob(c, 11.5, 11, 7.0, 6.6, VOID)
    for x in range(5, 19):
        if x % 3 != 1:
            c.px(x, 17 + (x % 2), VOID[1])
    ring(c, 11.5, 11, 9.6, 1.0, VOID[3], VOID[2])
    for ex in (9, 14):
        rect(c, ex, 10, 2, 2, hx("ffe060")); c.px(ex, 10, WHITE)


@icon
def parrot(c):
    blob(c, 12, 13, 5.2, 7.2, RED)
    poly(c, [(13, 10), (19, 14), (17, 20), (12, 17)], BLUE[2])
    for y in range(14, 20):
        c.px(17, y, hx("f0c020"))
    poly(c, [(10, 19), (14, 19), (13, 23), (11, 23)], BLUE[1])
    blob(c, 11, 6.5, 3.8, 3.6, RED)
    poly(c, [(6.5, 6), (8.5, 5), (8.5, 9), (7, 9)], hx("e8dcc0"))
    c.px(6, 8, DARK[1])
    blob(c, 11.5, 6.5, 1.4, 1.4, [WHITE, WHITE, WHITE]); c.px(11, 6, BLACK)
    for x in (10, 14):
        c.px(x, 21, GOLD[1]); c.px(x, 22, GOLD[1])


@icon
def baby_kraken(c):
    tent = PURPLE[1:4]
    for i, sx in enumerate((4, 8, 12, 16, 20)):  # curly tentacles
        for k in range(7):
            x = sx + math.sin(k * 0.9 + i) * 1.4
            c.px(x, 13 + k, tent[2] if k < 4 else tent[1])
            c.px(x + 1, 13 + k, tent[1])
        c.px(sx + 2, 20, tent[2]); c.px(sx + 2, 19, tent[2])
    blob(c, 12, 9.5, 7.8, 7.0, PURPLE)
    for ex in (8.5, 15.5):
        blob(c, ex, 10, 2.2, 2.4, [hx("e8e0ff"), WHITE, WHITE])
        rect(c, int(ex), 10, 2, 2, BLACK); c.px(int(ex), 10, WHITE)
    for x, y in ((9, 4), (14, 5), (11, 3)):
        c.px(x, y, PURPLE[4])


ICONS = [
    iron_helm, wizard_hat, ranger_hood, rogue_hood, chain_coif, gold_crown, dragon_crown, pirate_tricorn, horned_helm,
    round_specs, shadow_visor, mystic_monocle, dragons_gaze, eyepatch, sun_goggles,
    steel_armor, mage_robe, ranger_tunic, rogue_tunic, leather_vest, phoenix_plate, chainmail, pirate_coat,
    iron_sword, oak_staff, hunter_bow, shadow_dagger, composite_bow, ember_blade, void_blade, cutlass, trident,
    wooden_shield, iron_buckler, tome_of_sparks, lantern, tower_shield, crystal_orb, aegis, ships_compass, captains_hook,
    leather_boots, swift_sandals, iron_greaves, winged_boots, dragons_stride, sea_boots, shadow_treads,
    baby_slime, forest_fox, ember_sprite, void_familiar, parrot, baby_kraken,
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    groups = []
    for fn in ICONS:
        im = fn().image()
        im.save(OUT / f"{fn.__name__}.png")
        groups.append((fn.__name__.replace("_", " ").title(), [im]))
    preview(groups, scale=5, max_w=250, bg="checker", gap=18).save(OUT / "items_preview.png")
    print("wrote", len(ICONS), "item icons + preview to", OUT)


if __name__ == "__main__":
    main()
