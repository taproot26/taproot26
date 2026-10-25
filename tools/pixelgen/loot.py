#!/usr/bin/env python3
"""Monster drops: a spinning gold coin plus one signature item per monster.

Writes to out/loot:
  loot.png   5 icons, 16x16: slime_gel, spore_cap, bat_fang, goblin_ear, royal_jelly
  coin.png   4-frame coin spin, 16x16
  <id>.png   each icon on its own (used by the bag UI), plus gold.png
  loot_preview.png

    python3 tools/pixelgen/loot.py
"""
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from monsters import CAP, KING, SKIN, SLIME, SPOT  # noqa: E402
from pixel import Canvas, band, blob, clip_below, hx, light, poly, ramp  # noqa: E402

OUT = Path(__file__).resolve().parent / "out" / "loot"
GOLD = ramp("6b4a12", "a8781e", "d9a934", "f5d36a", "fff2b0")
IVORY = ramp("a89a84", "d8cdb6", "f2ead8", "fffaf0")
STEM = ramp("8a6a4a", "c4a27a", "e8cfa6")
WHITE = hx("ffffff")


def coin(f):
    c = Canvas(16, 16)
    rx = [5.5, 3.6, 1.3, 3.6][f]
    for y in range(16):
        for x in range(16):
            nx, ny = (x + 0.5 - 8) / rx, (y + 0.5 - 8) / 5.5
            d = nx * nx + ny * ny
            if d > 1:
                continue
            if f == 2:
                col = GOLD[3] if x < 8 else GOLD[1]
            elif d > 0.62:
                col = GOLD[1] if (nx > 0 or ny > 0.3) else GOLD[3]
            else:
                col = band(GOLD[2:], light(nx, ny))
            c.px(x, y, col)
    if f == 0:  # stamped star in the middle
        for x, y in ((8, 5), (7, 7), (8, 7), (9, 7), (6, 8), (10, 8), (8, 8), (7, 9), (9, 9), (8, 10)):
            c.px(x, y, GOLD[4] if (x, y) in ((8, 5), (7, 7)) else GOLD[1])
        c.px(5, 5, WHITE)
    elif f in (1, 3):
        c.px(7 if f == 1 else 8, 5, WHITE)
    c.outline()
    return c


def slime_gel():
    c = Canvas(16, 16)
    poly(c, [(6.0, 8), (8.0, 3), (10.0, 8)], SLIME[3])
    blob(c, 8, 10, 5.0, 4.0, SLIME)
    c.px(6, 8, WHITE); c.px(6, 9, SLIME[4]); c.px(7, 7, SLIME[4])
    c.outline()
    return c


def spore_cap():
    c = Canvas(16, 16)
    blob(c, 8, 7.5, 5.6, 3.8, CAP)
    clip_below(c, 8)
    for x in range(2, 14):
        if c.get(x, 8):
            c.px(x, 8, CAP[0])
    blob(c, 5.6, 6.2, 1.3, 1.1, SPOT)
    blob(c, 9.4, 5.0, 1.2, 1.0, SPOT)
    blob(c, 10.6, 7.0, 1.0, 0.9, SPOT)
    for y in range(9, 13):
        c.px(7, y, STEM[2]); c.px(8, y, STEM[1])
    c.outline()
    return c


def bat_fang():
    c = Canvas(16, 16)
    pts = [(5, 3), (11, 3), (10.6, 7), (9.2, 10), (7.2, 13), (6.2, 13.6), (6.8, 10), (7.0, 7), (6.0, 5)]
    poly(c, pts, IVORY[2])
    for y in range(16):  # light the left edge, shade the right edge
        row = [x for x in range(16) if c.get(x, y)]
        if row:
            c.px(row[0], y, IVORY[3])
            if len(row) > 2:
                c.px(row[-1], y, IVORY[1])
    for x in range(5, 12):
        c.px(x, 3, hx("c8a890")); c.px(x, 4, hx("e0c4b0") if c.get(x, 4) else None)
    c.outline()
    return c


def goblin_ear():
    c = Canvas(16, 16)
    poly(c, [(3, 10.5), (12, 2), (13.6, 3), (11.4, 9), (7.4, 13.2), (4, 12.8)], SKIN[2])
    poly(c, [(6, 10.5), (11, 4.5), (10.6, 8), (7.6, 11.2)], hx("b06a58"))
    for y in range(16):
        row = [x for x in range(16) if c.get(x, y) == SKIN[2]]
        if row:
            c.px(row[-1], y, SKIN[1])
            c.px(row[0], y, SKIN[3])
    c.outline()
    return c


def royal_jelly():
    c = Canvas(16, 16)
    blob(c, 8, 10, 5.0, 4.2, KING)
    for x in range(6, 11):
        c.px(x, 6, GOLD[2])
    for x in (6, 8, 10):
        c.px(x, 5, GOLD[3])
    c.px(8, 6, hx("d43a3a"))
    c.px(6, 9, WHITE); c.px(6, 10, KING[4]); c.px(7, 8, KING[4])
    c.outline()
    c.px(13, 4, WHITE); c.px(12, 3, hx("dce6ff")); c.px(14, 5, hx("dce6ff"))
    return c


ITEMS = [("slime_gel", slime_gel), ("spore_cap", spore_cap), ("bat_fang", bat_fang),
         ("goblin_ear", goblin_ear), ("royal_jelly", royal_jelly)]
NAMES = {"slime_gel": "Slime Gel", "spore_cap": "Spore Cap", "bat_fang": "Bat Fang",
         "goblin_ear": "Goblin Ear", "royal_jelly": "Royal Jelly"}


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    icons = []
    for name, make in ITEMS:
        im = make().image()
        im.save(OUT / f"{name}.png")
        icons.append((name, im))
    coins = [coin(f).image() for f in range(4)]
    coins[0].save(OUT / "gold.png")

    sheet = Image.new("RGBA", (16 * len(icons), 16), (0, 0, 0, 0))
    for i, (_, im) in enumerate(icons):
        sheet.alpha_composite(im, (i * 16, 0))
    sheet.save(OUT / "loot.png")
    strip = Image.new("RGBA", (64, 16), (0, 0, 0, 0))
    for i, im in enumerate(coins):
        strip.alpha_composite(im, (i * 16, 0))
    strip.save(OUT / "coin.png")

    # preview: coin frames then each item, labelled, at 8x on grass
    entries = [("Gold coin", coins)] + [(NAMES[n], [im]) for n, im in icons]
    H, scale = 40, 8
    W = 6 + sum(len(ims) * 17 + 10 for _, ims in entries)
    rng = random.Random(11)
    grass = [hx("6db54f"), hx("66ab48"), hx("74bd56")]
    base = Image.new("RGBA", (W, H))
    for y in range(H):
        for x in range(W):
            r = rng.random()
            base.putpixel((x, y), grass[0] if r < 0.7 else grass[1] if r < 0.88 else grass[2])
    spots, x = [], 6
    for name, ims in entries:
        gx = x
        for im in ims:
            base.alpha_composite(im, (x, 8))
            x += 17
        spots.append((name, (gx + x - 1) / 2))
        x += 10
    big = base.resize((W * scale, H * scale), Image.NEAREST)
    d = ImageDraw.Draw(big)
    font = ImageFont.load_default(size=20)
    for name, cx in spots:
        tw = d.textlength(name, font=font)
        d.text((cx * scale - tw / 2 + 2, 27 * scale + 2), name, font=font, fill=(20, 40, 18, 255))
        d.text((cx * scale - tw / 2, 27 * scale), name, font=font, fill=(255, 255, 255, 255))
    big.save(OUT / "loot_preview.png")
    print("wrote loot sheets + preview to", OUT)


if __name__ == "__main__":
    main()
