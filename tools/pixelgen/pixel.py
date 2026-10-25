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
