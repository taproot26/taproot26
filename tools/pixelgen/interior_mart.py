#!/usr/bin/env python3
"""Gen-3-style shop interior tileset (Pillow only, original art).

Builds 16x16 floor/wall/edge tiles and furniture sprites (multiples of 16),
saves each as a native PNG, then writes two previews: a labelled tile sheet
and a sample shop room composed only from those tiles.

    python3 tools/pixelgen/interior.py
"""
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixel import Canvas, blob, hx, mix, ramp  # noqa: E402

OUT = Path(__file__).resolve().parent / "out" / "interior_mart"
T = 16

VOID = hx("121216")
E_OUT, E_MID, E_HI = hx("2c3448"), hx("c3ccda"), hx("e9eef5")

ITEM_COLS = [ramp("a87a12", "f2c63a", "fbe58a"), ramp("8e2a22", "e0503a", "f6907a"),
             ramp("223f8a", "4a7ad8", "8ab0f2"), ramp("1f6a3a", "4ab06a", "8ade9e"),
             ramp("9a4a12", "f0903a", "f8c07a"), ramp("4a2a7a", "9a5ad0", "c69af0")]


def rect(c, x, y, w, h, col):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            c.px(xx, yy, col)


def item(c, x, y, w, h, r, bottle=False):
    """Small boxed good or bottle: lit left column, dark right column."""
    if bottle:
        c.px(x + w // 2, y, r[1]); y += 1; h -= 1
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            c.px(xx, yy, r[2] if xx == x else r[0] if xx == x + w - 1 else r[1])
    if not bottle and h >= 3:
        for xx in range(x, x + w):
            c.px(xx, y + h // 2, mix(r[1], (255, 255, 255, 255), 0.55))


# ------------------------------------------------------------------- floors

def floor_oct():
    c = Canvas(T, T)
    grout, base, hi, lo = hx("e9f6ee"), hx("a6dcc0"), hx("c4eed6"), hx("88c7a7")
    dia, dia_hi = hx("72bb96"), hx("8ed1ae")
    for y in range(T):
        for x in range(T):
            m = min(x + y, 15 - x + y, x + 15 - y, 30 - x - y)
            if m < 4:
                col = dia_hi if (x > 8 and y > 8) else dia
            elif m == 4 or x in (0, 15) or y in (0, 15):
                col = grout
            else:
                col = base
                if x == 1 or y == 1 or x + y == 5:
                    col = hi
                if x == 14 or y == 14 or 30 - x - y == 5:
                    col = lo
            c.px(x, y, col)
    return c


def floor_blue():
    c = Canvas(T, T)
    out, grout, inn, ihi, ilo = hx("4b80d2"), hx("3d69b6"), hx("6e9fee"), hx("8cb8f6"), hx("5a8ade")
    for y in range(T):
        for x in range(T):
            col = grout if (x == 15 or y == 15) else out
            if 3 <= x <= 12 and 3 <= y <= 12:
                col = ihi if (x == 3 or y == 3) else ilo if (x == 12 or y == 12) else inn
            c.px(x, y, col)
    return c


def floor_wood():
    c = Canvas(T, T)
    w = ramp("5a3418", "7a4a24", "9a6232", "b97c42")
    rng = random.Random(4)
    for y in range(T):
        for x in range(T):
            i, k = y // 4, y % 4
            if k == 3 or (x + i * 7) % 16 == 0:
                col = w[0]
            else:
                col = w[3] if k == 0 else w[2]
                if rng.random() < 0.07:
                    col = w[1]
            c.px(x, y, col)
    return c


# -------------------------------------------------------------------- walls

LIP_HI, LIP = hx("faf8f0"), hx("dad6ca")
WALL_HI, WALL, WALL_LO = hx("f6f7fa"), hx("e9ecf2"), hx("d8dde8")
BAND, BAND_LO, STRIPE = hx("8fd2e2"), hx("6ab4cc"), hx("f0883a")
BASE_HI, BASE, BASE_LO = hx("b6c2d2"), hx("94a3b9"), hx("6a768e")


def wall_upper():
    c = Canvas(T, T)
    rows = [hx("2e3448"), LIP_HI, LIP] + [WALL_HI] * 3 + [WALL] * 4 + [BAND, BAND, STRIPE, BAND_LO, BAND_LO, WALL]
    for y, col in enumerate(rows):
        for x in range(T):
            c.px(x, y, col)
    return c


def wall_lower():
    c = Canvas(T, T)
    rows = [WALL] * 11 + [WALL_LO, BASE_HI, BASE, BASE, BASE_LO]
    for y, col in enumerate(rows):
        for x in range(T):
            c.px(x, y, col)
    return c


def window():
    c = Canvas(T, T)
    frame, frame_lo = hx("cdd6e2"), hx("8a98ac")
    for y in range(2, 10):
        for x in range(1, 15):
            edge = x in (1, 14) or y in (2, 9) or x in (7, 8)
            if edge:
                col = frame_lo if (y == 9 or x == 14) else frame
            else:
                col = mix(hx("aee0f6"), hx("74b6e2"), (y - 3) / 5)
            c.px(x, y, col)
    for t in range(4):  # glass shine
        c.px(3 + t, 7 - t, hx("ffffff")); c.px(10 + t, 7 - t, hx("ffffff"))
        if t < 3:
            c.px(4 + t, 7 - t, hx("e4f6ff"))
    return c


def clock():
    c = Canvas(T, T)
    rim, rim_lo, face = hx("e8903c"), hx("b0662a"), hx("fbfbf4")
    for y in range(T):
        for x in range(T):
            d = ((x + 0.5 - 8) / 5.6) ** 2 + ((y + 0.5 - 7.5) / 5.6) ** 2
            if d <= 1:
                c.px(x, y, (rim_lo if y > 8 else rim) if d > 0.62 else face)
    for y in range(4, 8):
        c.px(7, y, hx("3a3a48"))
    for x in range(8, 11):
        c.px(x, 7, hx("3a3a48"))
    return c


# -------------------------------------------------------------- room edges

def _strip(c, x, horizontal=False):
    cols = (E_OUT, E_MID, E_HI)
    for i, col in enumerate(cols):
        for k in range(T):
            if horizontal:
                c.px(k, 15 - i, col)
            else:
                c.px(x[i], k, col)


def edge_left():
    c = Canvas(T, T); _strip(c, (0, 1, 2)); return c


def edge_right():
    c = Canvas(T, T); _strip(c, (15, 14, 13)); return c


def edge_bottom():
    c = Canvas(T, T); _strip(c, None, horizontal=True); return c


def edge_bl():
    """Bottom-left corner with the diagonal cut Gen-3 rooms use."""
    c = Canvas(T, T)
    for y in range(T):
        for x in range(T):
            d = x + 15 - y
            if d < 7:
                col = VOID
            elif d in (7, 8, 9):
                col = (E_OUT, E_MID, E_HI)[d - 7]
            elif x <= 2:
                col = (E_OUT, E_MID, E_HI)[x]
            elif y >= 13:
                col = (E_HI, E_MID, E_OUT)[y - 13]
            else:
                continue
            c.px(x, y, col)
    return c


def edge_br():
    c = Canvas(T, T)
    _strip(c, (15, 14, 13)); _strip(c, None, horizontal=True)
    return c


# ---------------------------------------------------------------- furniture

def counter(kind):
    c = Canvas(T, T)
    fr, fr2, frd = hx("f3f6fa"), hx("ccd5e1"), hx("8c9ab0")
    top, front, front_lo, base = hx("d2ecf7"), hx("a8d4ea"), hx("84b8d6"), hx("62779a")
    for x in range(T):
        c.px(x, 0, fr2)
        for y in range(1, 5):
            c.px(x, y, top)
        c.px(x, 5, fr)
        for y in range(6, 15):
            c.px(x, y, mix(front, front_lo, (y - 6) / 8))
        c.px(x, 15, base)
    for i, r in enumerate((ITEM_COLS[0], ITEM_COLS[1], ITEM_COLS[2])):
        x = 3 + i * 4 + (1 if kind == "mid" else 0)
        for yy in (10, 11):
            for xx in (x, x + 1):
                c.px(xx, yy, mix(r[1], front, 0.35))
    for t in range(5):  # shine on the glass front and top
        c.px(5 + t + (3 if kind == "right" else 0), 13 - t, hx("ffffff"))
    for t in range(3):
        c.px(9 + t, 4 - t, hx("ffffff"))
    if kind == "left":
        for y in range(T):
            c.px(0, y, frd); c.px(1, y, fr)
    if kind == "right":
        for y in range(T):
            c.px(15, y, frd); c.px(14, y, fr2)
    return c


def register():
    c = Canvas(T, T)
    body, body_hi, body_lo = hx("a6b0c2"), hx("cdd4e0"), hx("737e94")
    rect(c, 3, 2, 10, 7, body)
    for x in range(3, 13):
        c.px(x, 2, body_hi); c.px(x, 8, body_lo)
    for y in range(2, 9):
        c.px(12, y, body_lo); c.px(3, y, body_hi)
    rect(c, 5, 3, 6, 2, hx("2e5a4a"))
    c.px(6, 3, hx("8ae0b0")); c.px(8, 3, hx("8ae0b0"))
    for x in (5, 7, 9):
        c.px(x, 6, hx("5a6478"))
    c.outline()
    return c


def shelf(seed=0):
    c = Canvas(32, 32)
    rng = random.Random(10 + seed)
    rect(c, 1, 1, 30, 3, hx("eef1f6"))
    for x in range(1, 31):
        c.px(x, 1, hx("fafbfd")); c.px(x, 3, hx("c8d0dc"))
    rect(c, 3, 4, 26, 25, hx("c4ccd8"))
    for y in range(4, 31):
        c.px(1, y, hx("e2e7ee")); c.px(2, y, hx("cfd6e0")); c.px(29, y, hx("aab4c4")); c.px(30, y, hx("8e9aae"))
    for sy in (12, 20, 28):
        for x in range(3, 29):
            c.px(x, sy - 1, hx("f2f4f8")); c.px(x, sy, hx("aeb8c6"))
        x = 4
        while x < 27:
            w = rng.choice((2, 3, 3, 4))
            h = rng.choice((4, 5, 6))
            r = rng.choice(ITEM_COLS)
            if x + w > 28:
                break
            item(c, x, sy - 1 - h, w, h, r, bottle=w == 2)
            x += w + 1
    rect(c, 1, 29, 30, 2, hx("7a869a"))
    c.outline()
    return c


def cooler():
    c = Canvas(32, 32)
    rng = random.Random(21)
    rect(c, 1, 1, 30, 30, hx("eef2f6"))
    rect(c, 1, 2, 30, 3, hx("3a7ad0"))
    for x in range(4, 28, 3):
        c.px(x, 3, hx("cfe2fa"))
    for x in range(1, 31):
        c.px(x, 1, hx("fbfcfe")); c.px(x, 5, hx("2a5aa8"))
    for dx in (3, 17):
        for y in range(7, 29):
            for x in range(dx, dx + 12):
                edge = x in (dx, dx + 11) or y in (7, 28)
                c.px(x, y, hx("c8d2e0") if edge else mix(hx("b6e2f4"), hx("88c6e6"), (y - 8) / 20))
        for sy in (13, 19, 25):
            for x in range(dx + 1, dx + 11):
                c.px(x, sy, hx("e6f4fb"))
            x = dx + 2
            while x < dx + 10:
                r = rng.choice(ITEM_COLS)
                item(c, x, sy - 4, 1 if rng.random() < 0.5 else 2, 4, r, bottle=False)
                x += 3
        for t in range(6):
            c.px(dx + 2 + t, 26 - t * 2, hx("ffffff"))
    for y in range(15, 21):
        c.px(14, y, hx("5a6478")); c.px(17, y, hx("5a6478"))
    rect(c, 1, 29, 30, 2, hx("7a869a"))
    c.outline()
    return c


def rack():
    """Free-standing aisle rack, the vertical kind in the middle of a shop."""
    c = Canvas(T, 32)
    rng = random.Random(33)
    rect(c, 2, 1, 12, 4, hx("eef1f6"))
    for x in range(2, 14):
        c.px(x, 1, hx("fbfcfe")); c.px(x, 4, hx("c4ccd8"))
    rect(c, 2, 5, 12, 25, hx("c2cad6"))
    for y in range(5, 30):
        c.px(2, y, hx("dde2ea")); c.px(13, y, hx("8e9aae"))
    for sy in (11, 17, 23, 29):
        for x in range(3, 13):
            c.px(x, sy, hx("eef1f6"))
        for col in (4, 8):
            r = rng.choice(ITEM_COLS)
            item(c, col, sy - 4, 3, 4, r)
    rect(c, 2, 30, 12, 1, hx("6a768e"))
    c.outline()
    return c


def plant():
    c = Canvas(T, 32)
    leaf = ramp("1e5a2c", "2f8a3e", "4fb24e", "8edc6e")
    for cx, cy, rx, ry in ((8, 14, 6.0, 6.0), (5, 10, 3.6, 3.4), (11, 10, 3.6, 3.4), (8, 6, 4.0, 3.6), (8, 17, 5.2, 3.0)):
        blob(c, cx, cy, rx, ry, leaf)
    for x, y in ((6, 8), (10, 8), (8, 12), (5, 14), (11, 14), (8, 16)):
        c.px(x, y, leaf[1])
    for y in range(19, 23):
        c.px(7, y, hx("6a4024")); c.px(8, y, hx("4a2a16"))
    pot = ramp("8a96aa", "c6cfdc", "eef2f6")
    for y in range(22, 31):
        hw = 4 if y < 24 else 3
        for x in range(8 - hw, 8 + hw):
            col = pot[2] if x <= 8 - hw + 1 else pot[0] if x >= 8 + hw - 1 else pot[1]
            if y in (24, 25):
                col = hx("3a7ad0") if x < 8 + hw - 1 else hx("2a5aa8")
            c.px(x, y, col)
    c.outline()
    return c


def mat():
    c = Canvas(32, T)
    rect(c, 1, 3, 30, 10, hx("ec7432"))
    for x in range(1, 31):
        c.px(x, 3, hx("f6aa6a")); c.px(x, 12, hx("c4561c"))
    for y in range(3, 13):
        c.px(1, y, hx("f6aa6a")); c.px(30, y, hx("c4561c"))
    for x in range(4, 28):
        c.px(x, 5, hx("d85e22")); c.px(x, 10, hx("d85e22"))
    c.outline()
    return c


def clerk():
    c = Canvas(T, 24)
    sk = ramp("c88458", "eab088", "f8d6b2")
    hr = ramp("4a2414", "74401f", "a0602e")
    sh = ramp("2c4c9a", "3f6ad0", "6a92ea")
    ap = ramp("b8c0cc", "e4e8ee", "fcfcfc")
    for x in range(5, 11):  # legs and shoes
        for y in range(18, 21):
            c.px(x, y, hx("2a2a3a") if x in (7, 10) else hx("3c3c52"))
        c.px(x, 21, hx("2a1e1a"))
    for y in range(11, 18):  # shirt
        for x in range(4, 12):
            c.px(x, y, sh[2] if x == 4 else sh[0] if x >= 10 else sh[1])
    for y in range(12, 17):
        c.px(3, y, sh[1]); c.px(12, y, sh[0])
    c.px(3, 17, sk[1]); c.px(12, 17, sk[0])
    for y in range(12, 18):  # apron
        for x in range(5, 11):
            c.px(x, y, ap[2] if x == 5 else ap[0] if x == 10 else ap[1])
    c.px(6, 11, ap[1]); c.px(9, 11, ap[1])
    for y in range(4, 11):  # face
        for x in range(4, 12):
            c.px(x, y, sk[2] if x == 4 else sk[0] if (x == 11 or y == 10) else sk[1])
    for y in range(1, 6):  # hair
        for x in range(4, 12):
            if y >= 5 and 7 <= x <= 8:
                continue
            c.px(x, y, hr[2] if (y <= 2 and 5 <= x <= 8) else hr[1])
    for y in range(3, 8):
        c.px(3, y, hr[1]); c.px(12, y, hr[0])
    for y in (7, 8):
        c.px(6, y, hx("2a1a20")); c.px(9, y, hx("2a1a20"))
    c.px(5, 9, hx("f0a090")); c.px(10, 9, hx("f0a090"))
    c.outline()
    c.shadows.append((8, 22.5, 5, 1.4, 90))
    return c


# ------------------------------------------------------------------ preview

def label_sheet(pieces, scale=5):
    cols = 7
    cell = 32 * scale + 24
    rows = (len(pieces) + cols - 1) // cols
    W, H = cols * cell + 24, rows * (cell + 30) + 24
    sheet = Image.new("RGBA", (W, H), (236, 236, 240, 255))
    d = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=18)
    for i, (name, img) in enumerate(pieces):
        cx = 24 + (i % cols) * cell
        cy = 24 + (i // cols) * (cell + 30)
        for y in range(0, 32 * scale, 10):  # transparency checkerboard
            for x in range(0, 32 * scale, 10):
                if (x // 10 + y // 10) % 2:
                    d.rectangle((cx + x, cy + y, cx + x + 9, cy + y + 9), fill=(222, 222, 228, 255))
        big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
        sheet.alpha_composite(big, (cx + (32 * scale - big.width) // 2, cy + (32 * scale - big.height) // 2))
        tw = d.textlength(name, font=font)
        d.text((cx + (32 * scale - tw) / 2, cy + 32 * scale + 6), name, font=font, fill=(40, 40, 52, 255))
    return sheet


def compose_room(img):
    W, H = 13, 10
    room = Image.new("RGBA", (W * T, H * T), VOID)

    def put(name, tx, ty, oy=0):
        room.alpha_composite(img[name], (tx * T, ty * T + oy))

    for tx in range(1, 12):
        put("wall_upper", tx, 1)
        put("wall_lower", tx, 2)
        for ty in range(3, 9):
            put("floor_oct", tx, ty)
    shade = Image.new("RGBA", (11 * T, 3), (40, 64, 80, 70))
    room.alpha_composite(shade, (T, 3 * T))
    for tx in (2, 3, 4):
        put("window", tx, 1)
    put("clock", 7, 1)
    for ty in range(1, 9):
        put("edge_left", 1, ty)
        put("edge_right", 11, ty)
    for tx in range(1, 12):
        if tx not in (5, 6):
            put("edge_bottom", tx, 8)
    put("edge_bl", 1, 8)
    put("edge_br", 11, 8)
    put("plant", 5, 2)
    put("shelf_a", 6, 2)
    put("shelf_b", 8, 2)
    put("cooler", 10, 2)
    put("clerk", 2, 2, oy=14)
    put("counter_left", 1, 4)
    put("counter_mid", 2, 4)
    put("counter_right", 3, 4)
    put("register", 1, 4, oy=-5)
    put("rack", 7, 5)
    put("rack", 9, 5)
    put("mat", 5, 8)
    return room


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    makers = [
        ("floor_oct", floor_oct), ("floor_blue", floor_blue), ("floor_wood", floor_wood),
        ("wall_upper", wall_upper), ("wall_lower", wall_lower), ("window", window), ("clock", clock),
        ("edge_left", edge_left), ("edge_right", edge_right), ("edge_bottom", edge_bottom),
        ("edge_bl", edge_bl), ("edge_br", edge_br),
        ("counter_left", lambda: counter("left")), ("counter_mid", lambda: counter("mid")),
        ("counter_right", lambda: counter("right")), ("register", register),
        ("shelf_a", lambda: shelf(0)), ("shelf_b", lambda: shelf(1)), ("cooler", cooler),
        ("rack", rack), ("plant", plant), ("mat", mat), ("clerk", clerk),
    ]
    img = {}
    for name, make in makers:
        im = make().image()
        im.save(OUT / f"{name}.png")
        img[name] = im
    label_sheet([(n, img[n]) for n, _ in makers]).save(OUT / "tiles_preview.png")
    room = compose_room(img)
    room.resize((room.width * 5, room.height * 5), Image.NEAREST).save(OUT / "room_preview.png")
    print("wrote", len(makers), "pieces + 2 previews to", OUT)


if __name__ == "__main__":
    main()
