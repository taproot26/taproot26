#!/usr/bin/env python3
"""Field monsters + attack effect (Pillow only, original art, Gen-3 style).

Each monster has a 2-frame idle animation. Writes sprite sheets the game loads
directly, plus a preview:
  out/monsters/monsters.png    4 rows (slime, shroom, bat, goblin) x 2 frames, 24x24
  out/monsters/king_slime.png  2 frames, 32x32
  out/monsters/slash.png       3 frames, 24x24 (drawn facing right; rotate in-game)

    python3 tools/pixelgen/monsters.py
"""
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixel import Canvas, blob, clip_below, hx, line, poly, ramp  # noqa: E402

OUT = Path(__file__).resolve().parent / "out" / "monsters"

SLIME = ramp("1e5a1e", "2f8a2c", "4fb848", "8ee070", "d8ffc0")
KING = ramp("2a1e6a", "3e3aa8", "5a6ae0", "8eaaf6", "dce6ff")
CAP = ramp("5a1018", "9a2028", "d43a3a", "f07a6a")
SPOT = ramp("c8b89a", "ece0c4", "fffaf0")
BEIGE = ramp("8a6a4a", "c4a27a", "e8cfa6", "f8ead0")
BAT = ramp("241030", "3e1c54", "5e3482", "8a5ab4")
WING = ramp("1e0c28", "34184a", "52306e")
SKIN = ramp("2a4a1a", "4a7a2a", "6fa83e", "9cd06a")
TUNIC = ramp("3a2414", "5a3a20", "7a5230")
CLUB = ramp("3a2414", "6b4226", "8a5a32", "a8743f")
GOLD = ramp("6b4a12", "a8781e", "d9a934", "f5d36a")
EYE, WHITE = hx("1a2418"), hx("ffffff")


# ----------------------------------------------------------------- monsters

def slime_body(c, cx, bottom, rx, ry, rmp):
    """Jelly dome with a flat base: draw the ellipse, then cut it off at the floor."""
    blob(c, cx, bottom - ry * 0.85, rx, ry, rmp)
    clip_below(c, bottom)
    return bottom - ry * 0.85


def slime(f):
    c = Canvas(24, 24)
    rx, ry = (7.5, 6.5) if f == 0 else (8.6, 5.6)
    slime_body(c, 11.5, 20, rx, ry, SLIME)
    d = 0 if f == 0 else 1
    for x, y in ((7, 10), (8, 10), (7, 11), (9, 9)):
        c.px(x, y + d, SLIME[4])
    c.px(7, 10 + d, WHITE)
    for ex in (8, 14):
        for y in (13, 14, 15):
            c.px(ex, y + d, EYE); c.px(ex + 1, y + d, EYE)
        c.px(ex, 13 + d, WHITE)
    c.px(11, 17 + d, EYE); c.px(12, 17 + d, EYE)
    c.shadows.append((12, 21, 7.6 if f == 0 else 8.6, 1.6, 100))
    return c


def king_slime(f):
    c = Canvas(32, 32)
    rx, ry = (12.0, 10.0) if f == 0 else (13.2, 8.8)
    cy = slime_body(c, 15.5, 28, rx, ry, KING)
    top = int(cy - ry) + 1
    d = 0 if f == 0 else 2
    for x, y in ((9, 12), (10, 12), (11, 12), (9, 13), (10, 13), (9, 14), (13, 11)):
        c.px(x, y + d, KING[4])
    c.px(9, 12 + d, WHITE); c.px(10, 12 + d, WHITE)
    ey = int(cy) - 1
    for ex in (10, 19):
        for y in range(ey, ey + 4):
            for x in (ex, ex + 1, ex + 2):
                c.px(x, y, EYE)
        c.px(ex, ey, WHITE); c.px(ex + 1, ey, WHITE)
    for x in range(13, 19):
        c.px(x, ey + 6, EYE)
    c.px(13, ey + 5, EYE); c.px(18, ey + 5, EYE); c.px(14, ey + 7, WHITE)
    base = top + 1  # crown sitting on the dome
    for x in range(11, 21):
        c.px(x, base, GOLD[1]); c.px(x, base - 1, GOLD[2]); c.px(x, base - 2, GOLD[2] if x < 16 else GOLD[1])
    for px_ in (11, 15, 16, 20):
        c.px(px_, base - 3, GOLD[3]); c.px(px_, base - 4, GOLD[3] if px_ < 16 else GOLD[2])
    c.px(13, base - 1, hx("d43a3a")); c.px(18, base - 1, hx("3a7ad0")); c.px(15, base - 2, hx("4fc06a"))
    c.shadows.append((16, 29, rx, 2.2, 110))
    return c


def shroom(f):
    c = Canvas(24, 24)
    d = 0 if f == 0 else 1
    blob(c, 11.5, 9.5 + d, 9.2, 5.6, CAP)
    clip_below(c, 12 + d)
    blob(c, 7.5, 8 + d, 1.8, 1.6, SPOT)
    blob(c, 12.2, 6 + d, 1.6, 1.4, SPOT)
    blob(c, 16.2, 9 + d, 1.6, 1.5, SPOT)
    for x in range(4, 20):
        if c.get(x, 12 + d):
            c.px(x, 12 + d, CAP[0])
    for x0 in (8, 13):  # feet
        for x in range(x0, x0 + 3):
            c.px(x, 20, BEIGE[1] if x == x0 else BEIGE[0])
    for y in range(13 + d, 20):  # stem body
        for x in range(8, 16):
            col = BEIGE[3] if x == 8 else BEIGE[0] if x == 15 else BEIGE[1] if x == 14 else BEIGE[2]
            c.px(x, y, BEIGE[1] if y == 19 and 9 <= x <= 14 else col)
    for x in range(7, 17):
        c.px(x, 13 + d, BEIGE[0])  # shadow under the cap
    for ex in (10, 13):
        c.px(ex, 15 + d, EYE); c.px(ex, 16 + d, EYE)
    c.px(9, 17 + d, hx("f0a0a0")); c.px(14, 17 + d, hx("f0a0a0"))
    c.px(11, 18 + d, EYE); c.px(12, 18 + d, EYE)
    c.shadows.append((12, 21.2, 6.5, 1.4, 100))
    return c


def bat(f):
    c = Canvas(24, 24)
    d = 0 if f == 0 else 1
    if f == 0:
        wing = [(8.5, 10 + d), (6, 5), (2, 4), (0.6, 8), (2.6, 9), (3, 12), (5.5, 12), (7.5, 14 + d)]
        bone = ((8, 10 + d), (2, 4.6))
    else:
        wing = [(8.5, 11 + d), (5, 13), (0.6, 18), (3, 17.4), (4, 20), (6, 17), (7.8, 15 + d)]
        bone = ((8, 12 + d), (1.4, 17.6))
    for side in (0, 1):
        pts = wing if side == 0 else [(23 - x, y) for x, y in wing]
        poly(c, pts, WING[1])
        (x0, y0), (x1, y1) = bone
        if side:
            x0, x1 = 23 - x0, 23 - x1
        line(c, x0, y0, x1, y1, WING[2])
    blob(c, 11.5, 12.5 + d, 4.0, 4.4, BAT)
    for x, y in ((8, 6), (8, 7), (9, 7), (9, 8)):
        c.px(x, y + d, BAT[3] if y == 6 else BAT[2])
        c.px(23 - x, y + d, BAT[2] if y == 6 else BAT[1])
    c.px(10, 12 + d, hx("ffd040")); c.px(13, 12 + d, hx("ffd040"))
    c.px(11, 14 + d, BAT[0]); c.px(12, 14 + d, BAT[0])
    c.px(11, 15 + d, WHITE); c.px(12, 15 + d, WHITE)
    c.px(10, 17 + d, BAT[0]); c.px(13, 17 + d, BAT[0])
    c.shadows.append((12, 22, 4.6, 1.2, 80))  # hovering: small shadow on the ground
    return c


def goblin(f):
    c = Canvas(24, 24)
    d = 0 if f == 0 else 1
    for x0 in (9, 13):  # legs + feet
        for y in (19, 20):
            c.px(x0, y, SKIN[2]); c.px(x0 + 1, y, SKIN[1])
        for x in range(x0 - 1, x0 + 2):
            c.px(x, 21, hx("2a1a10"))
    for y in range(13 + d, 19):  # ragged tunic
        for x in range(8, 16):
            if y == 18 and x % 2:
                continue
            c.px(x, y, TUNIC[2] if x == 8 else TUNIC[0] if x == 15 else TUNIC[1])
    for x in range(8, 16):
        c.px(x, 16 + d, TUNIC[0])
    c.px(11, 16 + d, GOLD[2])
    for y in range(14 + d, 18 + d):  # arms
        c.px(7, y, SKIN[2]); c.px(16, y, SKIN[1])
    c.px(7, 18 + d, SKIN[1])
    line(c, 17, 16 + d, 18, 10 + d, CLUB[2])  # club
    line(c, 18, 16 + d, 19, 10 + d, CLUB[1])
    blob(c, 19, 8.5 + d - (1 if f == 1 else 0), 2.4, 3.0, CLUB)
    c.px(19, 7 + d, CLUB[0]); c.px(20, 9 + d, CLUB[0])
    c.px(16, 16 + d, SKIN[2])  # hand on the club
    poly(c, [(7.2, 8 + d), (2, 6 + d), (7.2, 10.6 + d)], SKIN[2])  # pointy ears
    poly(c, [(15.8, 8 + d), (21, 6 + d), (15.8, 10.6 + d)], SKIN[1])
    c.px(5, 7 + d, SKIN[0]); c.px(18, 7 + d, SKIN[0])
    blob(c, 11.5, 9 + d, 5.0, 4.4, SKIN)
    for x, y in ((9, 9), (10, 9), (9, 10), (13, 9), (14, 9), (14, 10)):
        c.px(x, y + d, hx("ffe040"))
    c.px(10, 10 + d, EYE); c.px(13, 10 + d, EYE)
    c.px(9, 8 + d, SKIN[0]); c.px(14, 8 + d, SKIN[0])
    for x in range(10, 14):
        c.px(x, 12 + d, hx("2a1a10"))
    c.px(11, 12 + d, hx("f4f0e0"))
    c.shadows.append((12, 21.6, 6.2, 1.4, 100))
    return c


def slash(f):
    """Crescent sword swing, facing right. No outline (it's an effect)."""
    c = Canvas(24, 24)
    a0, a1 = [(-80, -20), (-70, 45), (10, 80)][f]
    for y in range(24):
        for x in range(24):
            dx, dy = x + 0.5 - 7, y + 0.5 - 12
            r, a = math.hypot(dx, dy), math.degrees(math.atan2(dy, dx))
            if a0 <= a <= a1 and 7 <= r <= 11.5:
                if f == 2 and r < 9.5:
                    continue
                c.px(x, y, WHITE if r >= 9.5 else hx("bfe4ff"))
    return c


# ------------------------------------------------------------------ preview

def sheet(frames, w, h):
    rows = len(frames)
    cols = max(len(r) for r in frames)
    out = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
    for ry, row in enumerate(frames):
        for cx, img in enumerate(row):
            out.alpha_composite(img, (cx * w, ry * h))
    return out


def preview(groups, scale=6):
    W, H = 220, 92
    rng = random.Random(9)
    grass = [hx("6db54f"), hx("66ab48"), hx("74bd56")]
    base = Image.new("RGBA", (W, H))
    for y in range(H):
        for x in range(W):
            r = rng.random()
            base.putpixel((x, y), grass[0] if r < 0.7 else grass[1] if r < 0.88 else grass[2])
    spots, rows = [], [groups[:3], groups[3:]]
    for ri, row in enumerate(rows):
        total = sum(sum(im.width for im in imgs) + 2 * (len(imgs) - 1) for _, imgs in row) + 16 * (len(row) - 1)
        x, top = (W - total) // 2, 6 + ri * 46
        for name, imgs in row:
            gx = x
            for im in imgs:
                base.alpha_composite(im, (x, top + 32 - im.height))
                x += im.width + 2
            spots.append((name, (gx + x - 2) / 2, top + 32))
            x += 14
    big = base.resize((W * scale, H * scale), Image.NEAREST)
    d = ImageDraw.Draw(big)
    font = ImageFont.load_default(size=20)
    for name, cx, bottom in spots:
        tw = d.textlength(name, font=font)
        d.text((cx * scale - tw / 2 + 2, bottom * scale + 6), name, font=font, fill=(20, 40, 18, 255))
        d.text((cx * scale - tw / 2, bottom * scale + 4), name, font=font, fill=(255, 255, 255, 255))
    return big


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    def frames(fn, n=2, outline=True):
        res = []
        for f in range(n):
            c = fn(f)
            if outline:
                c.outline()
            res.append(c.image())
        return res

    kinds = [("Slime", slime), ("Shroomling", shroom), ("Bat", bat), ("Goblin", goblin)]
    regular = [(name, frames(fn)) for name, fn in kinds]
    king = frames(king_slime)
    swing = frames(slash, n=3, outline=False)
    sheet([imgs for _, imgs in regular], 24, 24).save(OUT / "monsters.png")
    sheet([king], 32, 32).save(OUT / "king_slime.png")
    sheet([swing], 24, 24).save(OUT / "slash.png")
    preview(regular + [("King Slime", king), ("Slash", swing)]).save(OUT / "monsters_preview.png")
    print("wrote monster sheets + preview to", OUT)


if __name__ == "__main__":
    main()
