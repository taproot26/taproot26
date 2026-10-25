"""Cozy farm-valley art for the Phaser fields: richer grass, warm sand paths,
bright water, leafy fruit trees, log fences and shingle-roofed cottages.

Ground textures are 64x64 and tile seamlessly (the fields map samples them
per pixel). Sprites keep the texture keys the fields scene already uses.

    python3 tools/pixelgen/build.py valley
"""
import random
from pathlib import Path

from PIL import Image

from pixel import Canvas, band, blob, hx, light, line, mix, poly, preview, ramp, rect

OUT = Path(__file__).resolve().parent / "out" / "valley"

GRASS = ramp("24522a", "32712c", "438f30", "57a834", "74c23e", "9bdb52")
SAND = ramp("8e4f22", "b46a2a", "d38c38", "e8a845", "f4c25e", "fad889")
TALL = ramp("2a6a2a", "3f8a30", "5aa838", "7cc444", "a8e060")
WATER = ramp("1d5d9e", "2a7fc4", "3a9fdc", "52bdea", "86d8f2", "c9f3ff")
LEAF = ramp("173d26", "22572c", "2f7431", "43923a", "62ad42", "8cc957")
PINE = ramp("10302a", "174236", "205a42", "2c7450", "3f8f5a", "5eab68")
BARK = ramp("3a2218", "583420", "784a2a", "9a6436", "b98048")
ORANGE = ramp("a8441a", "d86a22", "f39230", "ffc05a")
STONE = ramp("3e4250", "5a606e", "7c8392", "a2a9b6", "c8ced6")
WOOD = ramp("6e3a20", "945028", "b86d36", "d68e4a", "eeb066", "f8cf8c")
LOG = ramp("3c2416", "5a3620", "7a4c2c", "9a6638")
ROOF_RED = ramp("4a1212", "721c18", "9c2a1e", "c23e26", "de5a30", "f07e46")
ROOF_TEAL = ramp("12283a", "1a3d52", "235a6c", "2f7a82", "47999a", "6cb8ae")
DOOR = ramp("5a1616", "8a2420", "b4362a", "d65038")
GLASS = ramp("1f2a48", "2f4670", "5f8fc0", "a8daf2")
GOLD = hx("f6d264")
WHITE = hx("f6f4e6")


def wrap_px(c, x, y, col):
    c.px(x % c.w, y % c.h, col)


def shift(c, x, y, rmp, d):
    """Move a pixel's colour d steps along its ramp (no-op if not on it)."""
    col = c.get(x, y)
    if col in rmp:
        c.px(x, y, rmp[max(0, min(len(rmp) - 1, rmp.index(col) + d))])


def wnoise(w, h, cell, rng):
    """Smooth value noise that wraps on a w x h torus (cell must divide both)."""
    gw, gh = w // cell, h // cell
    g = [[rng.random() for _ in range(gw)] for _ in range(gh)]
    out = [[0.0] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            fx, fy = x / cell, y / cell
            x0, y0 = int(fx), int(fy)
            u, v = fx - x0, fy - y0
            u, v = u * u * (3 - 2 * u), v * v * (3 - 2 * v)
            a, b = g[y0 % gh][x0 % gw], g[y0 % gh][(x0 + 1) % gw]
            c_, d = g[(y0 + 1) % gh][x0 % gw], g[(y0 + 1) % gh][(x0 + 1) % gw]
            out[y][x] = a + (b - a) * u + (c_ - a) * v + (a - b - c_ + d) * u * v
    return out


# ------------------------------------------------------------- ground tiles

def tex_grass(seed=3):
    rng = random.Random(seed)
    c = Canvas(64, 64)
    n = wnoise(64, 64, 16, rng)
    for y in range(64):
        for x in range(64):
            v = n[y][x] + (rng.random() - 0.5) * 0.12
            c.px(x, y, GRASS[2] if v < 0.38 else GRASS[3] if v < 0.8 else GRASS[4])
    # leaf tufts: a dark shadow notch under three little blades
    for _ in range(150):
        x, y = rng.randrange(64), rng.randrange(64)
        lit = n[y][x] > 0.5
        hi, mid, lo = (GRASS[5], GRASS[4], GRASS[2]) if lit else (GRASS[4], GRASS[3], GRASS[1])
        for dx in (-1, 0, 1):
            wrap_px(c, x + dx, y + 1, lo)
        wrap_px(c, x - 1, y, mid); wrap_px(c, x - 2, y - 1, hi)
        wrap_px(c, x, y, mid); wrap_px(c, x, y - 1, mid); wrap_px(c, x, y - 2, hi)
        wrap_px(c, x + 1, y, mid); wrap_px(c, x + 2, y - 1, hi)
    for _ in range(40):  # single dark specks for grain
        wrap_px(c, rng.randrange(64), rng.randrange(64), GRASS[1])
    return c.image()


def tex_sand(seed=5):
    rng = random.Random(seed)
    c = Canvas(64, 64)
    n = wnoise(64, 64, 16, rng)
    for y in range(64):
        for x in range(64):
            v = n[y][x] + (rng.random() - 0.5) * 0.25
            c.px(x, y, SAND[2] if v < 0.3 else SAND[4] if v > 0.82 else SAND[3])
    for _ in range(14):  # hoe-mark crescents, like worked soil
        x, y = rng.randrange(64), rng.randrange(64)
        for dx in range(-3, 4):
            wrap_px(c, x + dx, y + (1 if abs(dx) == 3 else 0), SAND[2])
            if abs(dx) < 3:
                wrap_px(c, x + dx, y - 1, SAND[4])
    for _ in range(18):  # pebbles: lit top, shadow below
        x, y = rng.randrange(64), rng.randrange(64)
        w = rng.choice((2, 3))
        for dx in range(w):
            wrap_px(c, x + dx, y, SAND[5])
            wrap_px(c, x + dx, y + 1, SAND[4] if dx else SAND[5])
            wrap_px(c, x + dx, y + 2, SAND[1])
    for _ in range(70):
        wrap_px(c, rng.randrange(64), rng.randrange(64), rng.choice((SAND[2], SAND[4])))
    return c.image()


def tex_water(seed=9):
    rng = random.Random(seed)
    c = Canvas(64, 64)
    m = wnoise(64, 64, 8, rng)
    for y in range(64):
        for x in range(64):
            v = m[y][x] + (rng.random() - 0.5) * 0.1
            c.px(x, y, WATER[2] if v < 0.72 else WATER[3])
    # soft wave bands and bright glints: horizontal dashes
    for _ in range(40):
        x, y, L = rng.randrange(64), rng.randrange(64), rng.randint(3, 7)
        for dx in range(L):
            wrap_px(c, x + dx, y, WATER[4])
        wrap_px(c, x + L // 2, y, WATER[5])
        for dx in range(1, L - 1):
            wrap_px(c, x + dx, y + 1, WATER[2])
    for _ in range(8):
        x, y = rng.randrange(64), rng.randrange(64)
        wrap_px(c, x, y, WATER[5]); wrap_px(c, x + 1, y, WATER[5])
    return c.image()


# ------------------------------------------------------------------ helpers

def canopy(c, clumps, rmp, rng, fruit=None, flowers=False):
    """Leafy crown from overlapping clumps, each lit from the top-left; lower
    and right clumps sit a band darker. Then leaf texture, fruit, blossoms."""
    xs = [cx for cx, _, _ in clumps]
    ys = [cy for _, cy, _ in clumps]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    spread = max(1, max(abs(x - mx) for x in xs) + max(r for _, _, r in clumps))
    for cx, cy, r in sorted(clumps, key=lambda k: k[1]):
        bias = -((cx - mx) * 0.25 + (cy - my) * 0.6) / spread
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
                if nx * nx + ny * ny > 1:
                    continue
                l = light(nx, ny) * 0.8 + bias - 0.18
                if (x + y) % 2 == 0:
                    l += 0.06
                c.px(x, y, band(rmp, l))
    cells = [(x, y) for y in range(c.h) for x in range(c.w) if c.get(x, y) in rmp]
    for x, y in cells:
        if rng.random() < 0.16 and c.get(x, y + 1) in rmp:
            shift(c, x, y, rmp, 1)
            shift(c, x + 1, y + 1, rmp, -1)
    for x, y in cells:  # little leaf tips poking out of the silhouette
        if c.get(x, y - 1) is None and rng.random() < 0.35:
            c.px(x, y - 1, c.get(x, y))
    if fruit:
        spots = rng.sample([p for p in cells if c.get(p[0] + 2, p[1] + 2) in rmp], 6)
        placed = []
        for x, y in spots:
            if any(abs(x - a) < 6 and abs(y - b) < 6 for a, b in placed):
                continue
            placed.append((x, y))
            blob(c, x + 1.5, y + 1.5, 2.7, 2.7, fruit)
            c.px(x + 1, y - 1, LEAF[3])
    if flowers:
        for x, y in rng.sample(cells, 10):
            c.px(x, y, WHITE)


def trunk(c, x0, x1, y0, y1, flare=True):
    for y in range(y0, y1 + 1):
        grow = 1 if flare and y >= y1 - 1 else 0
        for x in range(x0 - grow, x1 + grow + 1):
            t = (x - x0 + grow) / max(1, x1 - x0 + 2 * grow)
            col = band(BARK, 0.5 - t * 1.3)
            if (y * 3 + x) % 7 == 0:
                col = BARK[max(0, BARK.index(col) - 1)]
            c.px(x, y, col)


def save(img, name):
    img.save(OUT / f"{name}.png")
    return img


# ------------------------------------------------------------------ sprites

def tree_round():
    rng = random.Random(11)
    c = Canvas(38, 48)
    trunk(c, 17, 20, 30, 45)
    c.px(16, 35, BARK[1]); c.px(21, 33, BARK[1])
    canopy(c, [(19, 13, 10), (9, 18, 8), (29, 18, 8), (13, 26, 8), (25, 26, 8), (19, 8, 8), (19, 22, 8)],
           LEAF, rng, fruit=ORANGE, flowers=True)
    c.shadows.append((19, 45, 10, 2.8, 90))
    c.outline()
    return c.image()


def tree_pine():
    rng = random.Random(13)
    c = Canvas(30, 48)
    trunk(c, 13, 16, 36, 45)
    tiers = [(6, 15, 9), (12, 22, 11), (19, 30, 13), (26, 38, 14)]  # top y, bottom y, half width
    for ty, by, hw in tiers:
        for y in range(ty, by + 1):
            t = (y - ty) / (by - ty)
            half = 2 + (hw - 2) * t
            for x in range(int(15 - half), int(15 + half) + 1):
                nx = (x + 0.5 - 15) / max(1, half)
                l = -0.6 * nx + 0.25 - t * 0.55 + (0.06 if (x + y) % 2 else 0)
                c.px(x, y, band(PINE, l))
        for x in range(15 - hw, 15 + hw + 1):  # jagged needle hem
            if (x + ty) % 3 == 0:
                c.px(x, by + 1, PINE[1])
            if (x + ty) % 3 == 1:
                c.px(x, by - 1, PINE[0])
    for y in range(2, 7):
        for x in range(15 - (y - 2) // 2, 16 + (y - 2) // 2):
            c.px(x, y, PINE[4] if x < 15 else PINE[3])
    cells = [(x, y) for y in range(48) for x in range(30) if c.get(x, y) in PINE]
    for x, y in cells:
        if rng.random() < 0.12:
            shift(c, x, y, PINE, 1)
    c.shadows.append((15, 45, 9, 2.6, 90))
    c.outline()
    return c.image()


def bush():
    rng = random.Random(17)
    c = Canvas(20, 17)
    canopy(c, [(10, 8, 6), (5, 10, 4.5), (15, 10, 4.5), (10, 11, 5)], LEAF, rng)
    for x, y in [(6, 7), (13, 6), (9, 11), (15, 11)]:
        c.px(x, y, hx("4d6fe0")); c.px(x + 1, y, hx("8fb0ff")); c.px(x, y + 1, hx("2e3f9a"))
    c.shadows.append((10, 15, 7, 2, 80))
    c.outline()
    return c.image()


def stump(tall):
    c = Canvas(16, 17 if tall else 14)
    top = 4 if tall else 6
    bot = c.h - 3
    for y in range(top, bot + 1):
        for x in range(3, 13):
            t = (x - 3) / 9
            c.px(x, y, band(BARK, 0.45 - t * 1.2))
    c.px(2, bot, BARK[1]); c.px(13, bot, BARK[0]); c.px(2, bot - 1, BARK[2])
    rings = ramp("a8743e", "c99a5c", "e2bb7c")
    for y in range(top - 2, top + 3):
        for x in range(2, 14):
            if ((x + 0.5 - 8) / 5.6) ** 2 + ((y + 0.5 - top) / 2.4) ** 2 <= 1:
                d = ((x + 0.5 - 8) / 5.6) ** 2 + ((y + 0.5 - top) / 2.4) ** 2
                c.px(x, y, rings[0] if d > 0.7 else rings[2] if d < 0.15 or 0.35 < d < 0.5 else rings[1])
    c.shadows.append((8, c.h - 2.5, 7, 2, 80))
    c.outline()
    return c.image()


def boulder():
    rng = random.Random(19)
    c = Canvas(18, 15)
    blob(c, 9, 8, 7.5, 5.5, STONE, dither=True)
    for y in range(12, 15):
        for x in range(c.w):
            c.p[y][x] = None
    for x in range(3, 15):
        if c.get(x, 11):
            c.px(x, 11, STONE[0] if x > 9 else STONE[1])
    line(c, 8, 6, 10, 9, STONE[1]); c.px(11, 9, STONE[1])
    for x, y in [(4, 5), (5, 4), (6, 4), (5, 5), (7, 3)]:  # moss
        c.px(x, y, LEAF[4] if rng.random() < 0.5 else LEAF[3])
    c.shadows.append((9, 12, 8, 2, 80))
    c.outline()
    return c.image()


def fence():
    """One post on the left plus two rails to the right. Laid every 16px."""
    c = Canvas(22, 20)
    for y in (8, 13):  # rails
        for x in range(4, 21):
            c.px(x, y, LOG[3]); c.px(x, y + 1, LOG[2]); c.px(x, y + 2, LOG[1])
            if x % 5 == 0:
                c.px(x, y + 1, LOG[1])
        rect(c, 18, y, 2, 3, None)
    post(c, 1)
    return c


def post(c, x0):
    for y in range(3, 18):
        for x in range(x0, x0 + 5):
            c.px(x, y, [LOG[3], LOG[3], LOG[2], LOG[1], LOG[0]][x - x0])
    for x in range(x0, x0 + 5):  # cut top
        c.px(x, 2, hx("b98a52") if 0 < x - x0 < 4 else LOG[2])
        c.px(x, 3, hx("d4a86a") if 0 < x - x0 < 4 else LOG[2])
    c.px(x0 + 2, 9, hx("8a8f9a")); c.px(x0 + 2, 14, hx("8a8f9a"))  # nails


def fence_img():
    c = fence()
    c.outline()
    return c.image()


def fence_post_img():
    c = Canvas(8, 20)
    post(c, 1)
    c.outline()
    return c.image()


def flower(petal, center):
    c = Canvas(11, 13)
    line(c, 5, 6, 5, 11, LEAF[2])
    c.px(4, 9, LEAF[3]); c.px(3, 8, LEAF[4]); c.px(6, 10, LEAF[3]); c.px(7, 9, LEAF[4])
    p = ramp(*petal)
    for dx, dy in [(0, -2), (-2, 0), (2, 0), (-1, 2), (1, 2), (-1, -1), (1, -1), (-2, 1), (2, 1)]:
        c.px(5 + dx, 4 + dy, p[1] if dy > 0 else p[2])
    c.px(4, 2, p[2]); c.px(6, 2, p[1]); c.px(3, 4, p[2]); c.px(7, 4, p[1])
    c.px(5, 4, hx(center)); c.px(4, 3, p[2])
    c.outline()
    return c.image()


def tall_grass(seed, rmp):
    rng = random.Random(seed)
    c = Canvas(16, 19)
    blades = sorted(((rng.uniform(1.5, 14.5), rng.randint(6, 16), rng.uniform(-3.5, 3.5)) for _ in range(11)), key=lambda b: -b[1])
    for bx, hgt, lean in blades:
        for i in range(hgt):
            t = i / hgt
            x = round(bx + lean * t * t)
            y = 17 - i
            col = rmp[1] if t < 0.3 else rmp[2] if t < 0.6 else rmp[3] if t < 0.85 else rmp[4]
            c.px(x, y, col)
            if t < 0.55:
                c.px(x + 1, y, rmp[1] if t < 0.25 else rmp[2])
    for x in range(2, 15):
        if c.get(x, 17):
            c.px(x, 18, rmp[0])
    c.outline()
    return c.image()


# ---------------------------------------------------------------- cottages

def cottage(w, h, roof, wall, eave_y, door_w=10, chimney=True, dormer=True, seed=1):
    """Front view: shingle hip roof over plank or stone walls, stone footing,
    door, two windows. Roof covers y in [1, eave_y]."""
    rng = random.Random(seed)
    c = Canvas(w, h)
    L, R = 5, w - 6  # wall extents
    foot = h - 5
    # walls
    for y in range(eave_y, foot):
        for x in range(L, R + 1):
            t = (x - L) / (R - L)
            if wall == "plank":
                col = band(WOOD, 0.62 - t * 0.5)
                if (y - eave_y) % 4 == 3:
                    col = WOOD[1]
                elif (y - eave_y) % 4 == 0:
                    col = WOOD[min(5, WOOD.index(col) + 1)]
                if (x * 7 + ((y - eave_y) // 4) * 13) % 23 == 0:
                    col = WOOD[1]
            else:
                row = (y - eave_y) // 4
                bx = (x + (row % 2) * 4) % 8
                col = band(STONE, 0.5 - t * 0.6 + (rng.random() - 0.5) * 0.15)
                if (y - eave_y) % 4 == 3 or bx == 0:
                    col = STONE[1]
            c.px(x, y, col)
    for y in range(eave_y, foot):  # corner beams
        for x, k in ((L, 3), (L + 1, 2), (R - 1, 1), (R, 0)):
            c.px(x, y, LOG[k])
    # footing
    for y in range(foot, h - 1):
        for x in range(L - 1, R + 2):
            bx = (x + ((y - foot) % 2) * 3) % 6
            c.px(x, y, STONE[1] if bx == 0 or y == h - 2 else STONE[3] if y == foot else STONE[2])
    # door
    dx0 = w // 2 - door_w // 2
    dy0 = foot - 22
    for y in range(dy0 - 2, foot):
        for x in range(dx0 - 2, dx0 + door_w + 2):
            c.px(x, y, LOG[1] if x in (dx0 - 2, dx0 + door_w + 1) or y == dy0 - 2 else LOG[2])
    for y in range(dy0, foot):
        for x in range(dx0, dx0 + door_w):
            t = (x - dx0) / (door_w - 1)
            col = band(DOOR, 0.5 - t * 1.1)
            if x == dx0 + door_w // 2 - 1 and y > dy0 + 8:
                col = DOOR[0]
            c.px(x, y, col)
    for gy in (dy0 + 2, dy0 + 5):  # small panes
        for gx in (dx0 + 2, dx0 + door_w - 4):
            rect(c, gx, gy, 2, 2, GLASS[1]); c.px(gx, gy, GLASS[3])
    c.px(dx0 + door_w - 3, dy0 + 13, GOLD); c.px(dx0 + door_w - 3, dy0 + 14, hx("b88a2a"))
    rect(c, dx0 - 1, foot, door_w + 2, 1, STONE[3])  # step
    # windows
    for wx in (L + 6, R - 17):
        wy = dy0 + 1
        rect(c, wx - 1, wy - 1, 14, 12, LOG[1])
        for y in range(wy, wy + 10):
            for x in range(wx, wx + 12):
                k = 1 if (x - wx) + (y - wy) > 8 else 2
                c.px(x, y, GLASS[k])
        line(c, wx + 1, wy + 3, wx + 3, wy + 1, GLASS[3]); c.px(wx + 7, wy + 6, GLASS[3])
        rect(c, wx + 5, wy, 2, 10, WOOD[3]); rect(c, wx, wy + 4, 12, 2, WOOD[3])
        rect(c, wx - 2, wy + 10, 16, 2, WOOD[4]); rect(c, wx - 2, wy + 11, 16, 1, WOOD[1])
        for fx in range(wx - 1, wx + 13, 3):  # flower box blooms
            c.px(fx, wy + 9, hx("ff7aa0") if (fx // 3) % 2 else hx("ffd84a"))
            c.px(fx + 1, wy + 9, LEAF[4])
    # eave shadow on the wall
    for y in range(eave_y, eave_y + 3):
        for x in range(L, R + 1):
            col = c.get(x, y)
            if col:
                c.px(x, y, mix(col, (40, 20, 30, 255), 0.45 - (y - eave_y) * 0.13))
    # roof: hip shape with scalloped shingle rows
    top, peak_hw = 1, w // 5
    pts = [(w / 2 - peak_hw, top), (w / 2 + peak_hw, top), (w - 1, eave_y), (0, eave_y)]
    rows = 0
    for y in range(top, eave_y + 1):
        row = (y - top) // 5
        rows = max(rows, row)
        for x in range(w):
            if not inside_roof(x + 0.5, y + 0.5, pts):
                continue
            sx = (x + (row % 2) * 4) % 8
            yy = (y - top) % 5
            t = x / (w - 1)
            l = 0.55 - t * 0.9 - (y - top) / (eave_y - top) * 0.35
            if yy == 4 or (yy == 3 and sx in (0, 7)) or (yy == 2 and sx == 0):
                l -= 0.6  # rounded scallop underside
            elif yy == 3 and sx in (1, 6):
                l -= 0.3
            elif yy in (0, 1) and sx in (2, 3):
                l += 0.35  # glint on each shingle
            col = band(roof, l)
            if rng.random() < 0.04:
                col = roof[max(0, roof.index(col) - 1)]
            c.px(x, y, col)
    for x in range(w):  # eave lip
        if c.get(x, eave_y):
            c.px(x, eave_y, roof[0])
            c.px(x, eave_y - 1, roof[1] if x > w / 2 else roof[2])
    for x in range(int(w / 2 - peak_hw), int(w / 2 + peak_hw) + 1):  # ridge cap
        c.px(x, top, roof[5] if x < w / 2 else roof[4])
        c.px(x, top + 1, roof[4] if x < w / 2 else roof[3])
    if dormer:
        dw, dh = 14, 12
        ox, oy = w // 2 - dw // 2, eave_y - dh - 6
        for y in range(oy, oy + dh):
            for x in range(ox, ox + dw):
                c.px(x, y, band(WOOD, 0.5 - (x - ox) / dw) if (y - oy) % 3 else WOOD[1])
        rect(c, ox + 3, oy + 3, 8, 7, LOG[1])
        rect(c, ox + 4, oy + 4, 6, 5, GLASS[1]); c.px(ox + 4, oy + 4, GLASS[3]); c.px(ox + 5, oy + 4, GLASS[2])
        rect(c, ox + 6, oy + 4, 1, 5, WOOD[3])
        for i in range(dw // 2 + 2):  # little gable roof
            y = oy + 1 - i // 2
            for x in range(ox - 1 + i, ox + dw - i + 1):
                c.px(x, y, roof[3] if x < w / 2 else roof[2])
    if chimney:
        cx0, cy1 = int(w * 0.7), top + 12
        for y in range(top - 1 if top > 0 else 0, cy1):
            for x in range(cx0, cx0 + 6):
                bx = (x + ((y % 4) // 2) * 2) % 4
                c.px(x, y, STONE[1] if bx == 0 or y % 2 == 1 and x == cx0 + 5 else STONE[3 if x < cx0 + 3 else 2])
        rect(c, cx0 - 1, 0, 8, 2, STONE[1]); rect(c, cx0, 0, 6, 1, STONE[3])
    c.shadows.append((w / 2, h - 2, w / 2 - 1, 3, 70))
    c.outline()
    return c.image()


def inside_roof(px, py, pts):
    (ax, ay), (bx, _), (cx, cy), (dx, _) = pts
    if py < ay or py > cy:
        return False
    t = (py - ay) / (cy - ay)
    return ax + (dx - ax) * t <= px <= bx + (cx - bx) * t


# --------------------------------------------------------------------- main

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    g, s, wt = save(tex_grass(), "grass"), save(tex_sand(), "sand"), save(tex_water(), "water")
    sprites = {
        "tree_round": tree_round(), "tree_pine": tree_pine(), "bush": bush(),
        "stump_tall": stump(True), "stump_short": stump(False), "boulder": boulder(),
        "fence": fence_img(), "fence_post": fence_post_img(),
        "house_a": cottage(80, 86, ROOF_RED, "plank", 44, seed=2),
        "house_b": cottage(64, 70, ROOF_TEAL, "stone", 34, door_w=10, chimney=True, dormer=False, seed=3),
        "flower_white": flower(("c8c8d8", "ececf4", "ffffff"), "f2c84a"),
        "flower_pink": flower(("c04a78", "ec7aa4", "ffb0cc"), "ffe070"),
        "flower_yellow": flower(("c88a1a", "f2c030", "ffe680"), "a8521e"),
        "flower_blue": flower(("3a50b8", "5f7ee8", "9cb4ff"), "ffffff"),
        "tall_a": tall_grass(21, TALL), "tall_b": tall_grass(22, TALL),
        "tall_dry": tall_grass(23, ramp("6e5418", "9a7a24", "c4a03a", "e2c45a", "f6e08a")),
    }
    for k, im in sprites.items():
        save(im, k)
    tiles = Image.new("RGBA", (192, 64))
    for i, im in enumerate((g, s, wt)):
        tiles.paste(im, (i * 64, 0))
    tiles2 = Image.new("RGBA", (128, 128))
    for i in range(4):
        tiles2.paste(g if i % 2 == 0 else g, ((i % 2) * 64, (i // 2) * 64))
    groups = [("grass / sand / water", [tiles]), ("grass 2x2", [tiles2])]
    groups += [(k, [im]) for k, im in sprites.items()]
    preview(groups, scale=4, max_w=360).save(OUT / "valley_preview.png")
    print(f"valley: {len(sprites) + 3} images -> {OUT}")


if __name__ == "__main__":
    main()
