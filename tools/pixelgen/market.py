#!/usr/bin/env python3
"""Procedural pixel-art market sprites (Pillow only).

Each sprite is drawn pixel by pixel at native size using hand-picked,
hue-shifted colour ramps (light from the top-left). Afterwards it gets a
coloured "selective outline" and a soft ground shadow. Writes native PNGs
for the game plus a 6x preview sheet.

    python3 tools/pixelgen/market.py
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from pixel import Canvas, band, blob, hx, light, mix, ramp

OUT = Path(__file__).resolve().parent / "out"
SCALE = 6


# Ramps run dark -> light. Shadows lean cool/saturated, highlights lean warm.
WOOD = ramp("3a2216", "5c3820", "82532e", "a8743f", "cf9d5f")
INT = ramp("1f1520", "2c1e28", "3b2a33")
RED = ramp("5a1622", "8e2430", "c4373a", "e8634e")
CREAM = ramp("8c7656", "c4ad84", "eadbb0", "fff4d6")
PURPLE = ramp("2b1745", "4b2873", "6f3ea6", "9a6bd1")
GOLD = ramp("6b4410", "a8741c", "dca73a", "f7d774")
GREEN = ramp("1c4126", "2e6b34", "4f9b3f", "8cc95a")
METAL = ramp("2a2a36", "4a4a5a", "7c7c8e", "b8b8c8")
APPLE = ramp("5c0f1c", "a51f2d", "dd3f3a", "ff9a7e")
ORANGE = ramp("7a3608", "c4650f", "f0952a", "ffd88a")
LIME = ramp("244a14", "4a8a22", "86c23a", "d6f294")
LEAF = hx("4f9b3f")
STEM = hx("3a2216")
BREAD = ramp("4f2810", "86471c", "bd7a36", "e6ae66", "f6d39a")
BERRY = ramp("3d0c2a", "7a1a4a", "b5306a", "e86a9a")
WICKER = ramp("4a2f16", "7a5228", "a87a3e", "d6aa62")
BURLAP = ramp("4d3820", "7a5c34", "a6844e", "cdb07a")
GRAIN = ramp("8a6a24", "c49a3a", "e8c766", "fbe7a6")
ROPE = ramp("5e4420", "947036", "c4a058")
STRIPE = ramp("4a1420", "7a2030", "a8343e", "c85a58")
GL_RED = ramp("5a0d22", "a51d3a", "e54a5a", "ffd6d6")
GL_GRN = ramp("0f3d2a", "1f7a45", "4fc06a", "dcffdc")
GL_BLU = ramp("15245e", "2b4fb0", "5a90f0", "e4f2ff")
GL_PNK = ramp("5c1a4a", "a53d8a", "e57ac4", "ffe4f6")
GL_TEAL = ramp("0d3d42", "1a7a80", "3ec0bf", "dcffff")
GL_GLD = ramp("5a3a0a", "a8701a", "e8b030", "fff4c0")
BALL = ramp("1a1a5a", "3a3aa8", "6a7af0", "eef4ff")


def dim(c, t=0.5):
    return mix(c, INT[1], t)


def fruit(c, x, y, r, stem=False):
    """4x4 round fruit with a specular dot."""
    c.px(x + 1, y, r[2]); c.px(x + 2, y, r[2])
    c.px(x, y + 1, r[2]); c.px(x + 1, y + 1, r[3]); c.px(x + 2, y + 1, r[1]); c.px(x + 3, y + 1, r[1])
    c.px(x, y + 2, r[1]); c.px(x + 1, y + 2, r[1]); c.px(x + 2, y + 2, r[1]); c.px(x + 3, y + 2, r[0])
    c.px(x + 1, y + 3, r[0]); c.px(x + 2, y + 3, r[0])
    if stem:
        c.px(x + 2, y - 1, STEM); c.px(x + 3, y - 1, LEAF)


# ---------------------------------------------------------------- stall frame
# 56 x 50 canvas. Awning x 4..51 (8 stripes of 6), roof rows 3..11,
# valance 12..17, interior 18..28, counter top 29..31, counter front 32..43.

def stall_frame(c, a, b, rng):
    for y in range(12, 32):  # posts
        c.px(5, y, WOOD[3]); c.px(6, y, WOOD[2])
        c.px(49, y, WOOD[2]); c.px(50, y, WOOD[1])
    for y in range(18, 29):  # shadowed back of the stall
        for x in range(7, 49):
            c.px(x, y, INT[0] if y < 20 else INT[1])
    for x in range(7, 49):  # back shelf
        c.px(x, 23, dim(WOOD[2])); c.px(x, 24, dim(WOOD[0]))

    top, x0, x1, st = 3, 4, 51, 6
    for y in range(top, top + 9):  # roof, narrowed at the back
        inset = max(0, top + 3 - y)
        for x in range(x0 + inset, x1 - inset + 1):
            r = a if ((x - x0) // st) % 2 == 0 else b
            s = 2
            if y == top:
                s = 1
            elif y == top + 8:
                s = 3
            elif (x - x0) % st == 0:
                s = 3
            c.px(x, y, r[s])
    vt = top + 9
    for x in range(x0, x1 + 1):  # scalloped valance
        r = a if ((x - x0) // st) % 2 == 0 else b
        col = (x - x0) % st
        c.px(x, vt, r[2])
        for y in range(vt + 1, vt + 4):
            c.px(x, y, r[1])
        if 1 <= col <= st - 2:
            c.px(x, vt + 4, r[1])
        if 2 <= col <= st - 3:
            c.px(x, vt + 5, r[0])

    for x in range(5, 51):  # counter top
        c.px(x, 29, WOOD[2]); c.px(x, 30, WOOD[3]); c.px(x, 31, WOOD[4])
    for y in range(32, 44):  # counter front planks
        for x in range(6, 50):
            k = (y - 32) % 4
            col = WOOD[0] if (y == 43 or k == 3) else WOOD[3] if k == 0 else WOOD[2]
            if k in (1, 2) and rng.random() < 0.05:
                col = WOOD[1]
            c.px(x, y, col)
        c.px(6, y, WOOD[3]); c.px(7, y, WOOD[2]); c.px(48, y, WOOD[1]); c.px(49, y, WOOD[0])
    c.shadows.append((28, 45, 26, 3.2, 110))


def sign(c, icon):
    for y in range(10, 17):
        for x in range(23, 33):
            edge = y in (10, 16) or x in (23, 32)
            col = WOOD[1] if edge else CREAM[3] if y == 11 else CREAM[1] if y == 15 else CREAM[2]
            c.px(x, y, col)
    icon(c)


def icon_apple(c):
    fruit(c, 26, 12, APPLE)
    c.px(28, 11, STEM); c.px(29, 11, LEAF)


def icon_potion(c):
    c.px(27, 11, WOOD[3]); c.px(27, 12, GL_PNK[2])
    for y in (13, 14, 15):
        c.px(26, y, GL_PNK[2]); c.px(27, y, GL_PNK[1]); c.px(28, y, GL_PNK[0])
    c.px(26, 13, GL_PNK[3])


def icon_bread(c):
    blob(c, 28, 13.6, 3.2, 1.9, BREAD)
    c.px(26, 13, BREAD[1]); c.px(28, 13, BREAD[1])


# ------------------------------------------------------------------- stalls

def fruit_stall():
    rng = random.Random(1)
    c = Canvas(56, 50)
    stall_frame(c, RED, CREAM, rng)
    for x in (10, 21, 32, 41):  # dim baskets on the back shelf
        for xx in range(x, x + 6):
            c.px(xx, 22, dim(WICKER[2])); c.px(xx, 21, dim(WICKER[3]) if xx % 2 else dim(WICKER[2]))
        for i, xx in enumerate(range(x + 1, x + 5)):
            c.px(xx, 20, dim([APPLE, ORANGE, LIME][(x + i) % 3][2], 0.55))
    for x, fr in ((9, APPLE), (22, ORANGE), (35, LIME)):
        for fx in (2, 6):
            fruit(c, x + fx, 19, fr, stem=fr is APPLE)
        for fx in (0, 4, 8):
            fruit(c, x + fx, 22, fr, stem=fr is APPLE and fx == 4)
        for xx in range(x, x + 12):  # crate front
            c.px(xx, 26, WOOD[3])
            for y in range(27, 31):
                c.px(xx, y, WOOD[1] if y == 28 else WOOD[2])
        for y in range(26, 31):
            c.px(x, y, WOOD[1]); c.px(x + 11, y, WOOD[1])
    sign(c, icon_apple)
    return c


def bottle(c, x, base, g):
    c.px(x + 1, base - 6, WOOD[3])
    c.px(x + 1, base - 5, g[2])
    for y in range(base - 4, base):
        c.px(x, y, g[2]); c.px(x + 1, y, g[1]); c.px(x + 2, y, g[0])
    c.px(x, base - 3, g[3])
    for xx in range(x, x + 3):
        c.px(xx, base, g[0])


def flask(c, cx, base, g):
    blob(c, cx + 0.5, base - 1.9, 2.7, 2.5, g[:3])
    c.px(cx, base - 5, g[2]); c.px(cx, base - 6, g[1]); c.px(cx, base - 7, WOOD[3])
    c.px(cx - 1, base - 3, g[3])


def potion_stall():
    rng = random.Random(2)
    c = Canvas(56, 50)
    stall_frame(c, PURPLE, GOLD, rng)
    glass = [GL_RED, GL_GRN, GL_BLU, GL_PNK, GL_TEAL, GL_GLD]
    for i, x in enumerate(range(9, 47, 3)):  # small bottles on the back shelf
        g = glass[i % len(glass)]
        c.px(x, 20, dim(g[2])); c.px(x, 21, dim(g[2])); c.px(x + 1, 21, dim(g[1]))
        c.px(x, 22, dim(g[1])); c.px(x + 1, 22, dim(g[0]))
    bottle(c, 9, 30, GL_RED)
    bottle(c, 13, 30, GL_GRN)
    flask(c, 19, 30, GL_BLU)
    # crystal ball on a gold stand
    for x in range(25, 32):
        c.px(x, 30, GOLD[1])
    for x in range(26, 31):
        c.px(x, 29, GOLD[2])
    c.px(26, 29, GOLD[3])
    blob(c, 28.5, 25, 3.6, 3.6, BALL[:3])
    c.px(26, 23, BALL[3]); c.px(27, 23, BALL[3]); c.px(26, 24, BALL[3])
    flask(c, 36, 30, GL_PNK)
    bottle(c, 40, 30, GL_TEAL)
    bottle(c, 44, 30, GL_GLD)
    sign(c, icon_potion)
    return c


def bakery_stall():
    rng = random.Random(3)
    c = Canvas(56, 50)
    stall_frame(c, GREEN, CREAM, rng)
    dbread = [dim(b, 0.45) for b in BREAD]
    for x in range(10, 46, 7):  # loaves on the back shelf
        blob(c, x + 2.5, 21.5, 2.6, 1.4, dbread)
    # long loaf with diagonal score marks
    blob(c, 12, 27.6, 4.6, 2.6, BREAD)
    for k in (-2, 0, 2):
        c.px(12 + k, 27, BREAD[1]); c.px(12 + k - 1, 26, BREAD[4])
    # round boule with a cross cut
    blob(c, 20.5, 27, 3.4, 3.0, BREAD)
    c.px(20, 26, BREAD[1]); c.px(19, 26, BREAD[1]); c.px(21, 26, BREAD[1]); c.px(20, 25, BREAD[1]); c.px(20, 27, BREAD[1])
    # tray of rolls
    for cx, cy in ((26.5, 27.2), (30, 27.2), (25, 28.4), (28.5, 28.4), (32, 28.4)):
        blob(c, cx, cy, 1.9, 1.5, BREAD)
    for x in range(24, 34):
        c.px(x, 29, WICKER[3] if x % 2 else WICKER[2]); c.px(x, 30, WICKER[1])
    # berry pie in a tin
    blob(c, 38.5, 27.4, 4.0, 1.9, BERRY)
    for x in range(35, 43):
        for y in (26, 27, 28):
            if (x + y) % 3 == 0 and c.get(x, y) in BERRY:
                c.px(x, y, BREAD[3])
    for x in range(34, 44):
        c.px(x, 29, METAL[3] if x < 36 else METAL[2]); c.px(x, 30, METAL[1])
    # baguettes standing in a basket
    for bx in (44, 46):
        for y in range(19, 27):
            c.px(bx, y, BREAD[3]); c.px(bx + 1, y, BREAD[2])
            if y % 2 and y > 19:
                c.px(bx + 1, y, BREAD[1])
        c.px(bx, 19, BREAD[2])
    for x in range(43, 49):
        for y in range(26, 31):
            c.px(x, y, WICKER[2] if (x + (y // 2)) % 2 else WICKER[1])
        c.px(x, 26, WICKER[3])
    sign(c, icon_bread)
    return c


# -------------------------------------------------------------------- props

def barrel():
    c = Canvas(24, 27)
    cx = 11.5
    for y in range(9, 23):
        hw = 7 + (1 if 12 <= y <= 19 else 0) - (1 if y == 22 else 0)
        x0 = int(cx - hw + 0.5)
        for x in range(x0, int(cx + hw + 0.5)):
            nx = (x + 0.5 - cx) / hw
            l = -0.65 * nx + 0.05
            if y in (11, 12, 19, 20):  # iron hoops
                c.px(x, y, band(METAL, l + (0.25 if y in (11, 19) else 0)))
                continue
            col = band(WOOD, l - (0.15 if y == 22 else 0))
            if (x - x0) % 3 == 2:  # stave seams
                col = WOOD[max(0, WOOD.index(col) - 1)]
            c.px(x, y, col)
    for y in range(5, 13):  # lid
        for x in range(3, 21):
            nx, ny = (x + 0.5 - cx) / 7.0, (y + 0.5 - 9) / 2.6
            if nx * nx + ny * ny > 1:
                continue
            rim = (nx * nx + ny * ny) > 0.55
            if rim:
                c.px(x, y, WOOD[1] if ny > 0 else WOOD[2])
            else:
                c.px(x, y, WOOD[2] if x % 3 == 0 else band(WOOD[2:], light(nx, ny)))
    c.shadows.append((11.5, 23.5, 8.6, 2.2, 110))
    return c


def crate():
    c = Canvas(24, 24)
    for x in range(4, 20):  # top face
        for y in range(4, 9):
            c.px(x, y, WOOD[2] if y in (4, 6) else WOOD[4] if y == 8 else WOOD[3])
    for y in range(9, 21):  # front face with frame boards
        for x in range(4, 20):
            frame = y in (9, 10, 19, 20) or x in (4, 5, 18, 19)
            c.px(x, y, WOOD[1] if frame else (WOOD[1] if y == 14 else WOOD[2]))
        c.px(4, y, WOOD[3])
    for i in range(12):  # diagonal brace
        x, y = 6 + i, 18 - round(i * 7 / 11)
        c.px(x, y, WOOD[3]); c.px(x, y + 1, WOOD[1])
    for x, y in ((5, 10), (18, 10), (5, 19), (18, 19)):
        c.px(x, y, METAL[3])
    c.shadows.append((12, 21.5, 9.5, 2.0, 110))
    return c


def sack():
    c = Canvas(24, 25)
    blob(c, 11.5, 15.2, 7.8, 6.6, BURLAP, dither=True)
    for y in (14, 17):  # red stripes woven into the sack
        for x in range(24):
            col = c.get(x, y)
            if col in BURLAP:
                c.px(x, y, STRIPE[BURLAP.index(col)])
    for y in range(7, 10):  # narrow pinched neck
        for x in range(10, 14):
            c.px(x, y, BURLAP[3] if x == 10 else BURLAP[1] if x == 13 else BURLAP[2])
    for x in range(8, 16):  # frayed, flared opening
        c.px(x, 6, BURLAP[2] if x < 12 else BURLAP[1])
    for x, y in ((8, 5), (10, 4), (12, 5), (14, 4), (15, 5), (9, 5), (13, 5)):
        c.px(x, y, BURLAP[3] if x < 12 else BURLAP[2])
    for x in (10, 11, 12):
        c.px(x, 5, GRAIN[3] if x % 2 else GRAIN[2])
    c.px(11, 4, GRAIN[3])
    for x in range(10, 14):  # rope tie
        c.px(x, 8, ROPE[2]); c.px(x, 9, ROPE[1])
    c.px(14, 9, ROPE[2]); c.px(15, 10, ROPE[1]); c.px(15, 11, ROPE[2])
    for x, y in ((17, 21), (19, 21), (18, 22)):  # a little spilled grain
        c.px(x, y, GRAIN[2])
    c.shadows.append((12, 22, 9.2, 2.0, 110))
    return c


def basket():
    c = Canvas(24, 24)
    for i in range(0, 61):  # handle
        a = math.pi + math.pi * i / 60
        x, y = 11.5 + 6.6 * math.cos(a), 13 + 9 * math.sin(a)
        c.px(x, y, WICKER[3] if x < 11.5 else WICKER[2])
    for x, y, fr in ((7, 8, ORANGE), (12, 8, APPLE), (5, 10, APPLE), (9, 10, LIME), (14, 10, ORANGE)):
        fruit(c, x, y, fr, stem=fr is APPLE)
    for x in range(4, 20):  # braided rim
        c.px(x, 13, WICKER[3] if x % 2 else WICKER[2]); c.px(x, 14, WICKER[2] if x % 2 else WICKER[1])
    for y in range(15, 21):  # woven body, tapering down
        hw = 7.5 - (y - 15) * 0.45
        r = (y - 15) // 2
        for x in range(int(11.5 - hw + 0.5), int(11.5 + hw + 0.5)):
            idx = 2 if ((x + (r % 2) * 2) // 3) % 2 else 1
            nx = (x + 0.5 - 11.5) / hw
            idx += 1 if nx < -0.55 else -1 if nx > 0.55 else 0
            c.px(x, y, WICKER[max(0, min(3, idx))])
    for x in range(8, 16):
        c.px(x, 21, WICKER[0])
    c.shadows.append((12, 21.8, 8.2, 2.0, 110))
    return c


# ------------------------------------------------------------------ preview

def preview(sprites):
    W, H = 200, 102
    rng = random.Random(7)
    grass = [hx("6db54f"), hx("66ab48"), hx("74bd56")]
    sheet = Image.new("RGBA", (W, H))
    for y in range(H):
        for x in range(W):
            r = rng.random()
            sheet.putpixel((x, y), grass[0] if r < 0.7 else grass[1] if r < 0.88 else grass[2])
    spots = []
    row1 = sprites[:3]
    x = (W - (3 * 56 + 2 * 10)) // 2
    for name, img in row1:
        sheet.alpha_composite(img, (x, 5))
        spots.append((name, x + img.width / 2, 5 + img.height))
        x += 56 + 10
    row2 = sprites[3:]
    total = sum(img.width for _, img in row2) + 14 * (len(row2) - 1)
    x = (W - total) // 2
    for name, img in row2:
        y = 64 + (27 - img.height)
        sheet.alpha_composite(img, (x, y))
        spots.append((name, x + img.width / 2, 64 + 27))
        x += img.width + 14
    big = sheet.resize((W * SCALE, H * SCALE), Image.NEAREST)
    d = ImageDraw.Draw(big)
    font = ImageFont.load_default(size=20)
    for name, cx, bottom in spots:
        tx, ty = cx * SCALE, bottom * SCALE + 4
        tw = d.textlength(name, font=font)
        d.text((tx - tw / 2 + 2, ty + 2), name, font=font, fill=(20, 40, 18, 255))
        d.text((tx - tw / 2, ty), name, font=font, fill=(255, 255, 255, 255))
    return big


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    makers = [("Fruit stall", fruit_stall), ("Potion stall", potion_stall), ("Bakery stall", bakery_stall),
              ("Barrel", barrel), ("Crate", crate), ("Grain sack", sack), ("Fruit basket", basket)]
    sprites = []
    for name, make in makers:
        c = make()
        c.outline()
        img = c.image()
        img.save(OUT / f"market_{name.lower().replace(' ', '_')}.png")
        sprites.append((name, img))
    preview(sprites).save(OUT / "market_preview.png")
    print("wrote", len(sprites), "sprites + preview to", OUT)


if __name__ == "__main__":
    main()
