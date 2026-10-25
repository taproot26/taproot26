"""Core helpers for the procedural pixel-art generators in this folder.

Draw at native size on a Canvas (one colour per pixel, None = transparent),
shade with hand-picked ramps lit from the top-left, then call outline() for a
coloured selective outline and image() to get a Pillow RGBA image (with any
ground shadows composited underneath).

Generators: market.py (stalls + props), interior.py (medieval shop tiles),
interior_mart.py (Gen-3 mart tiles). Run any of them with python3.
"""
from PIL import Image


def hx(s):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


def ramp(*hexes):
    """Colour ramp, dark -> light. Lean shadows cool and highlights warm."""
    return [hx(h) for h in hexes]


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.p = [[None] * w for _ in range(h)]
        self.shadows = []  # (cx, cy, rx, ry, alpha) soft ground shadows

    def px(self, x, y, c):
        x, y = int(x), int(y)
        if c is not None and 0 <= x < self.w and 0 <= y < self.h:
            self.p[y][x] = c

    def get(self, x, y):
        return self.p[y][x] if 0 <= x < self.w and 0 <= y < self.h else None

    def outline(self):
        """Selective outline: edge pixels take a dark, purple-shifted version of
        the darkest colour they touch rather than flat black. Grows the sprite by
        1px, so leave a 1px margin when drawing."""
        adds = []
        for y in range(self.h):
            for x in range(self.w):
                if self.p[y][x] is not None:
                    continue
                ns = [self.get(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                ns = [n for n in ns if n]
                if ns:
                    n = min(ns, key=lum)
                    adds.append((x, y, (int(n[0] * 0.30 + 10), int(n[1] * 0.26 + 6), int(n[2] * 0.32 + 20), 255)))
        for x, y, c in adds:
            self.p[y][x] = c

    def image(self):
        sh = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        for cx, cy, rx, ry, a in self.shadows:
            for y in range(self.h):
                for x in range(self.w):
                    if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                        sh.putpixel((x, y), (24, 16, 34, a))
        img = Image.new("RGBA", (self.w, self.h), (0, 0, 0, 0))
        for y in range(self.h):
            for x in range(self.w):
                if self.p[y][x]:
                    img.putpixel((x, y), self.p[y][x])
        return Image.alpha_composite(sh, img)


def rect(c, x, y, w, h, col):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            c.px(xx, yy, col)


CUTS = {3: (-0.25, 0.35), 4: (-0.35, 0.10, 0.50), 5: (-0.50, -0.15, 0.20, 0.55),
        6: (-0.60, -0.30, 0.0, 0.30, 0.60)}


def band(rmp, l):
    """Pick a ramp colour for a light value (higher = brighter)."""
    i = sum(1 for k in CUTS[len(rmp)] if l >= k)
    return rmp[min(i, len(rmp) - 1)]


def light(nx, ny):
    """Light from the top-left for a surface normal in [-1, 1]."""
    return -0.55 * nx - 0.80 * ny + 0.10


def blob(c, cx, cy, rx, ry, rmp, dither=False):
    """Filled ellipse shaded as a rounded volume lit from the top-left."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if nx * nx + ny * ny > 1:
                continue
            l = light(nx, ny)
            if dither:  # checkerboard where two bands meet
                for k in CUTS[len(rmp)]:
                    if abs(l - k) < 0.06 and (x + y) % 2 == 0:
                        l = k - 0.07 if l >= k else k + 0.07
            c.px(x, y, band(rmp, l))


def sprite(make):
    """Build a Canvas with `make()`, outline it, and return the RGBA image."""
    c = make()
    c.outline()
    return c.image()


# ---------------------------------------------------------------- shapes

def clip_below(c, y0):
    """Erase everything under row y0 (flat bases for domes, caps, slimes)."""
    for y in range(y0 + 1, c.h):
        for x in range(c.w):
            c.p[y][x] = None


def inside(px, py, pts):
    ins, j = False, len(pts) - 1
    for i in range(len(pts)):
        (xi, yi), (xj, yj) = pts[i], pts[j]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
            ins = not ins
        j = i
    return ins


def poly(c, pts, col):
    """Fill a polygon (pixel centres inside it)."""
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        for x in range(int(min(xs)), int(max(xs)) + 1):
            if inside(x + 0.5, y + 0.5, pts):
                c.px(x, y, col)


def line(c, x0, y0, x1, y1, col, w=1):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n):
        t = i / max(1, n - 1)
        x, y = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t)
        for k in range(w):
            c.px(x + k, y, col)


def shade_cols(c, x0, x1, y0, y1, rmp, base=None):
    """Re-colour a region's existing pixels by column: left lit, right shaded."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if c.get(x, y) is not None:
                t = (x - x0) / max(1, x1 - x0)
                c.px(x, y, band(rmp, 0.55 - t * 1.2) if base is None else base)


# --------------------------------------------------------------- sheets

def strip(frames, w, h, cols=None):
    """Pack equally sized frames into a sheet, row-major."""
    cols = cols or len(frames)
    rows = (len(frames) + cols - 1) // cols
    out = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
    for i, im in enumerate(frames):
        out.alpha_composite(im, ((i % cols) * w + (w - im.width) // 2, (i // cols) * h + (h - im.height)))
    return out


def grass_bg(w, h, seed=7):
    import random
    rng = random.Random(seed)
    cols = [hx("6db54f"), hx("66ab48"), hx("74bd56")]
    img = Image.new("RGBA", (w, h))
    for y in range(h):
        for x in range(w):
            r = rng.random()
            img.putpixel((x, y), cols[0] if r < 0.7 else cols[1] if r < 0.88 else cols[2])
    return img


def checker_bg(w, h, cell=4):
    img = Image.new("RGBA", (w, h))
    for y in range(h):
        for x in range(w):
            img.putpixel((x, y), (236, 233, 226, 255) if ((x // cell) + (y // cell)) % 2 else (224, 220, 212, 255))
    return img


def preview(groups, scale=6, max_w=230, bg="grass", gap=12):
    """Labelled contact sheet. `groups` is a list of (label, [frames]); each
    group's frames sit side by side with the label underneath, wrapping rows."""
    from PIL import ImageDraw, ImageFont
    rows, row, x = [], [], 0
    for g in groups:
        gw = sum(im.width for im in g[1]) + 2 * (len(g[1]) - 1)
        if row and x + gw > max_w:
            rows.append(row); row, x = [], 0
        row.append(g); x += gw + gap
    if row:
        rows.append(row)
    label_h = 9
    heights = [max(im.height for _, ims in r for im in ims) for r in rows]
    W = max(sum(sum(im.width for im in ims) + 2 * (len(ims) - 1) for _, ims in r) + gap * (len(r) - 1) for r in rows) + 2 * gap
    H = sum(h + label_h + 6 for h in heights) + 6
    base = grass_bg(W, H) if bg == "grass" else checker_bg(W, H)
    spots, top = [], 6
    for r, h in zip(rows, heights):
        rw = sum(sum(im.width for im in ims) + 2 * (len(ims) - 1) for _, ims in r) + gap * (len(r) - 1)
        x = (W - rw) // 2
        for name, ims in r:
            gx = x
            for im in ims:
                base.alpha_composite(im, (x, top + h - im.height))
                x += im.width + 2
            spots.append((name, (gx + x - 2) / 2, top + h))
            x += gap - 2
        top += h + label_h + 6
    big = base.resize((W * scale, H * scale), Image.NEAREST)
    d = ImageDraw.Draw(big)
    font = ImageFont.load_default(size=max(14, scale * 3))
    dark = bg != "grass"
    for name, cx, bottom in spots:
        tw = d.textlength(name, font=font)
        tx, ty = cx * scale - tw / 2, bottom * scale + scale
        if not dark:
            d.text((tx + 2, ty + 2), name, font=font, fill=(20, 40, 18, 255))
        d.text((tx, ty), name, font=font, fill=(52, 40, 32, 255) if dark else (255, 255, 255, 255))
    return big
