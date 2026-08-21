"""
Builds the piece sprite.

The six standard pieces are lifted straight out of the bundled Font Awesome
webfonts. The six variant pieces are composed from those same outlines plus a
little generated geometry, so that every piece shares one drawing style and the
whole sprite can be regenerated after a tweak.

Shapes that need cutting are cut here rather than with an SVG clip path, because
a clip path does not resolve inside the shadow tree of a <use>, which is how the
sprite is drawn. Cut shapes are flattened to polygons first; at the size a board
square gives them the difference is invisible.

Requires fonttools and brotli:  python -m pip install fonttools brotli
Run from the repository root:   python tools/build-pieces.py
"""
import math
import re

from fontTools.misc.transform import Transform
from fontTools.pens.basePen import BasePen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from shapely import affinity
from shapely.geometry import MultiPolygon, Polygon, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

# Bigger than the drawing, for half planes expressed as boxes.
BIG = 10000

FONTS = 'src/assets/fontawesome-7.1.0/webfonts'
OUTPUT = 'src/app/components/piece-sprite/piece-sprite.html'

# Codepoints from all.min.css, e.g. .fa-chess-knight{--fa:"\\f441"}
STANDARD = {
    'pawn': 0xF443,
    'rook': 0xF447,
    'knight': 0xF441,
    'bishop': 0xF43A,
    'queen': 0xF445,
    'king': 0xF43F,
}
DRAGON = 0xF6D5
VARIANTS = {'solid': 'fa-solid-900.woff2', 'outline': 'fa-regular-400.woff2'}

# A box wide enough for the widest glyph and tall enough for the tallest, so every
# piece shares one coordinate space and stands on the same baseline.
WIDTH = 512
TOP = 480
BOTTOM = -64
HEIGHT = TOP - BOTTOM
MIDDLE = WIDTH / 2

# The weight of the outlines in the regular font, measured off its vertical walls.
STROKE = 48

# How finely curves are chopped up before cutting, and how much of the result is
# thrown away again as indistinguishable from a straight line.
DEBUG = False
CURVE_STEPS = 10
FLAT_TOLERANCE = 0.4

# --- unicorn -----------------------------------------------------------------
# The horn is pulled out of the head's own outline: the midpoint of the straight run
# along the top of the muzzle is displaced up and back until it reaches the top of
# the head. Corners are left sharp; at the size a board square gives them, rounding
# them makes no visible difference.
HORN_ANGLE = 30
HORN_HOLLOW = True      # whether the horn is hollow, like the rest of the outline
HORN_MIN_EDGE = 100     # the muzzle line is the longest straight run up there
# Kept tight: the chest has a straight run of its own that is longer still.
HORN_REGION = (200, 200)

# --- royal queen and common king ---------------------------------------------
# The king's cross: a plus with rounded ends, read off the king outline.
CROSS_STEM_X = (232, 280)
CROSS_BAR_Y = (64, 112)
CROSS_TOP, CROSS_BOTTOM = 0, 192
CROSS_RADIUS = 24
# The queen's dot, and where it sits once the king has lost its cross.
DOT_RADIUS = {'solid': 48, 'outline': 40}
DOT_CENTRE = (256, 128)

# --- brawn -------------------------------------------------------------------
# The collar just below the pawn's head, and the pair of studs hung off it.
STUD_Y = 224
STUD_X = (104, 408)
STUD_RADIUS = 52

# --- dragon ------------------------------------------------------------------
BASE_TOP = 420          # where a chess piece's flared base takes over
DRAGON_KEEP = 352       # how much of fa-dragon is the head and the wing
DRAGON_WING_SCALE = 0.75
DRAGON_WING_NARROW = 0.75  # narrowed again, keeping its trailing edge in place
DRAGON_WING_TUCK = 200  # how far the wing sits behind the neck, so the two meet
DRAGON_MARGIN = 16
DRAGON_OVERLAP = 24     # how far the neck runs into the base before being cut
DRAGON_BASE_NUDGE = 0   # further adjustment after the base is lined up with the neck


class PlainPen(BasePen):
    """Writes paths using only M, L, C and Z, so every number is part of a point."""

    def __init__(self, glyphSet):
        super().__init__(glyphSet)
        self.parts = []

    def _moveTo(self, pt):
        self.parts.append('M' + point(pt))

    def _lineTo(self, pt):
        self.parts.append('L' + point(pt))

    def _curveToOne(self, one, two, three):
        self.parts.append('C' + point(one) + ' ' + point(two) + ' ' + point(three))

    def _closePath(self):
        self.parts.append('Z')

    def commands(self):
        return ''.join(self.parts)


def num(value):
    return f'{round(value, 1):g}'


def point(pt):
    return num(pt[0]) + ' ' + num(pt[1])


def load():
    """Every glyph we draw from, keyed by name and variant, in sprite coordinates."""
    paths = {}
    for variant, filename in VARIANTS.items():
        font = TTFont(f'{FONTS}/{filename}')
        glyphs = font.getGlyphSet()
        cmap = font.getBestCmap()
        wanted = dict(STANDARD)
        if DRAGON in cmap:
            wanted['dragon'] = DRAGON
        for name, code in wanted.items():
            glyph = glyphs[cmap[code]]
            pen = PlainPen(glyphs)
            # Fonts draw upward from the baseline; SVG draws downward from the top.
            glyph.draw(TransformPen(pen, Transform(1, 0, 0, -1, (WIDTH - glyph.width) / 2, TOP)))
            paths[(name, variant)] = pen.commands()
    return paths


# --- turning paths into polygons and back ------------------------------------

def flatten(path):
    """Chops a path of M, L, C and Z into closed polygons."""
    tokens = re.findall(r'([MLCZ])([^MLCZ]*)', path)
    polygons, current, cursor = [], [], (0.0, 0.0)
    for command, body in tokens:
        values = [float(v) for v in re.findall(r'-?\d+\.?\d*', body)]
        pairs = list(zip(values[0::2], values[1::2]))
        if command == 'M':
            if len(current) > 2:
                polygons.append(current)
            current = [pairs[0]]
            cursor = pairs[0]
        elif command == 'L':
            current.extend(pairs)
            cursor = pairs[-1]
        elif command == 'C':
            for i in range(0, len(pairs), 3):
                one, two, three = pairs[i:i + 3]
                for step in range(1, CURVE_STEPS + 1):
                    current.append(cubic(cursor, one, two, three, step / CURVE_STEPS))
                cursor = three
        elif command == 'Z' and len(current) > 2:
            polygons.append(current)
            current = []
    if len(current) > 2:
        polygons.append(current)
    return polygons


def cubic(start, one, two, three, t):
    u = 1 - t
    return (u * u * u * start[0] + 3 * u * u * t * one[0] + 3 * u * t * t * two[0] + t * t * t * three[0],
            u * u * u * start[1] + 3 * u * u * t * one[1] + 3 * u * t * t * two[1] + t * t * t * three[1])


def simplify(polygon):
    """Drops points that sit on the line between their neighbours."""
    if len(polygon) < 3:
        return polygon
    kept = [polygon[0]]
    for i in range(1, len(polygon) - 1):
        before, here, after = kept[-1], polygon[i], polygon[i + 1]
        span = math.dist(before, after)
        if span == 0:
            continue
        area = abs((after[0] - before[0]) * (before[1] - here[1])
                   - (before[0] - here[0]) * (after[1] - before[1]))
        if area / span >= FLAT_TOLERANCE:
            kept.append(here)
    kept.append(polygon[-1])
    return kept


def cut(polygons, keep, cross):
    """Sutherland-Hodgman against one half plane."""
    out = []
    for polygon in polygons:
        clipped = []
        for i, here in enumerate(polygon):
            before = polygon[i - 1]
            if keep(here):
                if not keep(before):
                    clipped.append(cross(before, here))
                clipped.append(here)
            elif keep(before):
                clipped.append(cross(before, here))
        if len(clipped) > 2:
            out.append(clipped)
    return out


def cut_box(polygons, x0=None, y0=None, x1=None, y1=None):
    def at_x(value):
        return lambda a, b: (value, a[1] + (b[1] - a[1]) * (value - a[0]) / (b[0] - a[0]))

    def at_y(value):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (value - a[1]) / (b[1] - a[1]), value)

    if x0 is not None:
        polygons = cut(polygons, lambda p: p[0] >= x0, at_x(x0))
    if x1 is not None:
        polygons = cut(polygons, lambda p: p[0] <= x1, at_x(x1))
    if y0 is not None:
        polygons = cut(polygons, lambda p: p[1] >= y0, at_y(y0))
    if y1 is not None:
        polygons = cut(polygons, lambda p: p[1] <= y1, at_y(y1))
    return polygons


def to_path(polygons):
    parts = []
    for polygon in polygons:
        polygon = simplify(polygon)
        if len(polygon) < 3:
            continue
        parts.append('M' + point(polygon[0]))
        parts.extend('L' + point(p) for p in polygon[1:])
        parts.append('Z')
    return ''.join(parts)


def area(polygon):
    return abs(sum(polygon[i][0] * polygon[i - 1][1] - polygon[i - 1][0] * polygon[i][1]
                   for i in range(len(polygon)))) / 2


def subtract(polygons, region):
    """
    Everything outside a convex region. The outside of a convex shape is the union
    of the outsides of its edges, and overlapping copies still fill under the
    nonzero rule, so the pieces can simply be drawn on top of one another.
    """
    inside = (sum(p[0] for p in region) / len(region), sum(p[1] for p in region) / len(region))
    out = []
    for i in range(len(region)):
        a, b = region[i], region[(i + 1) % len(region)]

        def side(p, a=a, b=b):
            return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])

        sign = 1 if side(inside) > 0 else -1

        def keep(p, side=side, sign=sign):
            return side(p) * sign <= 0

        def cross(p, q, side=side):
            here, there = side(p), side(q)
            t = here / (here - there)
            return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)

        out.extend(cut(polygons, keep, cross))
    return out


def scaled(shape, across, down, origin):
    return affinity.scale(shape, xfact=across, yfact=down, origin=origin)


def translate(shape, across, down):
    return affinity.translate(shape, xoff=across, yoff=down)


def to_rings(shape):
    """
    A shapely shape as plain rings. Outsides are wound one way and holes the other,
    which is what the nonzero fill rule needs to punch them through.
    """
    pieces = shape.geoms if isinstance(shape, MultiPolygon) else [shape]
    rings = []
    for piece in pieces:
        if piece.is_empty:
            continue
        piece = orient(piece, sign=1.0)
        rings.append(list(piece.exterior.coords))
        rings.extend(list(hole.coords) for hole in piece.interiors)
    return rings


def move_polygons(polygons, fn):
    return [[fn(p) for p in polygon] for polygon in polygons]


def span(polygons):
    xs = [p[0] for polygon in polygons for p in polygon]
    ys = [p[1] for polygon in polygons for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)




# --- generated shapes --------------------------------------------------------

def circle(cx, cy, r):
    k = r * 0.5523
    return (f'M{num(cx)} {num(cy - r)}'
            f'C{num(cx + k)} {num(cy - r)} {num(cx + r)} {num(cy - k)} {num(cx + r)} {num(cy)}'
            f'C{num(cx + r)} {num(cy + k)} {num(cx + k)} {num(cy + r)} {num(cx)} {num(cy + r)}'
            f'C{num(cx - k)} {num(cy + r)} {num(cx - r)} {num(cy + k)} {num(cx - r)} {num(cy)}'
            f'C{num(cx - r)} {num(cy - k)} {num(cx - k)} {num(cy - r)} {num(cx)} {num(cy - r)}Z')


def rounded_plus():
    """The king's cross, as a filled plus with rounded ends."""
    left, right = CROSS_STEM_X
    bar_top, bar_bottom = CROSS_BAR_Y
    far_left, far_right = 160, 352
    r = CROSS_RADIUS
    return (
        f'M{num(left + r)} {num(CROSS_TOP)}H{num(right - r)}'
        f'A{num(r)} {num(r)} 0 0 1 {num(right)} {num(CROSS_TOP + r)}V{num(bar_top)}'
        f'H{num(far_right - r)}A{num(r)} {num(r)} 0 0 1 {num(far_right)} {num(bar_top + r)}'
        f'V{num(bar_bottom - r)}A{num(r)} {num(r)} 0 0 1 {num(far_right - r)} {num(bar_bottom)}'
        f'H{num(right)}V{num(CROSS_BOTTOM)}H{num(left)}V{num(bar_bottom)}'
        f'H{num(far_left + r)}A{num(r)} {num(r)} 0 0 1 {num(far_left)} {num(bar_bottom - r)}'
        f'V{num(bar_top + r)}A{num(r)} {num(r)} 0 0 1 {num(far_left + r)} {num(bar_top)}'
        f'H{num(left)}V{num(CROSS_TOP + r)}'
        f'A{num(r)} {num(r)} 0 0 1 {num(left + r)} {num(CROSS_TOP)}Z')



def steps(path):
    """Walks a path, yielding each command with the point it starts from."""
    cursor = None
    for command, body in re.findall(r'([MLCZ])([^MLCZ]*)', path):
        values = [float(v) for v in re.findall(r'-?\d+\.?\d*', body)]
        pairs = list(zip(values[0::2], values[1::2]))
        yield command, body, cursor, pairs
        if command == 'M':
            cursor = pairs[0]
        elif command == 'L':
            cursor = pairs[-1]
        elif command == 'C':
            cursor = pairs[-1]


def muzzle(contour):
    """The long straight run along the top of the muzzle, if this contour has one."""
    best = None
    for command, _, cursor, pairs in steps(contour):
        if command != 'L' or cursor is None:
            continue
        end = pairs[0]
        middle = ((cursor[0] + end[0]) / 2, (cursor[1] + end[1]) / 2)
        length = math.dist(cursor, end)
        if (length >= HORN_MIN_EDGE
                and middle[0] < HORN_REGION[0] and middle[1] < HORN_REGION[1]
                and (best is None or length > best[2])):
            best = (cursor, end, length)
    return best


def extrude_horn(path):
    """
    Draws the horn out of the head's own outline rather than laying a shape over it:
    the midpoint of the muzzle line is pulled up and back, taking the outline with
    it. The inner contour follows, running parallel a stroke's width inside, so the
    horn keeps the weight the rest of the drawing is built at.
    """
    angle = math.radians(HORN_ANGLE)
    direction = (-math.sin(angle), -math.cos(angle))
    contours = [c for c in re.split(r'(?=M)', path) if c.strip()]
    outer = max(range(len(contours)), key=lambda i: max(area(p) for p in flatten(contours[i])))

    edge = muzzle(contours[outer])
    if edge is None:
        return path
    start, end, _ = edge
    middle = ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
    reach = middle[1] / -direction[1]
    tip = (middle[0] + direction[0] * reach, middle[1] + direction[1] * reach)
    flanks = (shift(tip, start, end, STROKE), shift(tip, end, start, STROKE))

    return ''.join(raise_muzzle(contour, tip) if index == outer
                   else (inset_muzzle(contour, flanks) if HORN_HOLLOW else contour)
                   for index, contour in enumerate(contours))


def raise_muzzle(contour, tip):
    """The outer edge, running straight from each end of the muzzle up to the tip."""
    edge = muzzle(contour)
    if edge is None:
        return contour
    start, end, _ = edge
    return rebuild(contour, start, end, [tip])


def inset_muzzle(contour, flanks):
    """
    The inner edge. Its flanks are the outer ones moved inward, so the two run
    parallel; where each meets the muzzle line is a mitred corner, which leaves a
    short length of the original muzzle at either end. Four parts rather than two.
    """
    edge = muzzle(contour)
    if edge is None:
        return contour
    start, end, _ = edge
    tip = meeting(*flanks)
    corners = [meeting(flank, (start, end)) for flank in flanks]
    if tip is None or any(corner is None for corner in corners):
        return contour
    corners.sort(key=lambda corner: math.dist(start, corner))
    return rebuild(contour, start, end, [corners[0], tip, corners[1]])


def rebuild(contour, start, end, points):
    """Replaces the run from start to end with a run through the given points."""
    replacement = ''.join('L' + point(p) for p in points) + 'L' + point(end)
    out = []
    for command, body, cursor, pairs in steps(contour):
        if command == 'L' and cursor == start and pairs[0] == end:
            out.append(replacement)
        else:
            out.append(command + body)
    return ''.join(out)


def shift(start, end, toward, distance):
    """A line moved sideways by a distance, in the direction of a third point."""
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = math.hypot(dx, dy)
    across = (-dy / length, dx / length)
    if (toward[0] - start[0]) * across[0] + (toward[1] - start[1]) * across[1] < 0:
        across = (-across[0], -across[1])
    return ((start[0] + across[0] * distance, start[1] + across[1] * distance),
            (end[0] + across[0] * distance, end[1] + across[1] * distance))


def meeting(one, two):
    (x1, y1), (x2, y2) = one
    (x3, y3), (x4, y4) = two
    divisor = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(divisor) < 1e-9:
        return None
    first = x1 * y2 - y1 * x2
    second = x3 * y4 - y3 * x4
    return ((first * (x3 - x4) - (x1 - x2) * second) / divisor,
            (first * (y3 - y4) - (y1 - y2) * second) / divisor)


def dragon(paths, variant):
    """
    fa-dragon turned to face the other way. Its head and its wing are separate
    contours in the original, so each is placed on its own; the pair is then scaled
    as one, which keeps every proportion the drawing started with. The neck runs
    down into the flared base of a pawn and is cut off there, and the base slides
    across to line up underneath it.
    """
    parts = [p for p in flatten(paths[('dragon', 'solid')]) if area(p) > 1]
    parts.sort(key=area, reverse=True)

    head = Polygon(parts[0])
    for ring in parts[2:]:
        head = head.difference(Polygon(ring))
    wing = Polygon(parts[1])

    head = scaled(head, -1, 1, (MIDDLE, 0))
    wing = scaled(wing, -1, 1, (MIDDLE, 0))
    head = head.intersection(box(-BIG, -BIG, BIG, DRAGON_KEEP))

    # Sit the wing on the same ground as the head, tucked in behind the neck.
    hx1, hy1 = head.bounds[2], head.bounds[3]
    wing = scaled(wing, DRAGON_WING_SCALE, DRAGON_WING_SCALE, (wing.bounds[0], wing.bounds[3]))
    wing = translate(wing, (hx1 - DRAGON_WING_TUCK) - wing.bounds[0], hy1 - wing.bounds[3])
    # Narrow it further, leaving its trailing edge where it is.
    wing = scaled(wing, DRAGON_WING_NARROW, 1, (wing.bounds[2], 0))

    # One shape, so the outlined version traces the silhouette and not the seam.
    beast = unary_union([head, wing])
    x0, y0, x1, y1 = beast.bounds
    scale = min((WIDTH - 2 * DRAGON_MARGIN) / (x1 - x0),
                (BASE_TOP + DRAGON_OVERLAP) / (y1 - y0))
    beast = scaled(beast, scale, scale, (x0, y1))
    beast = translate(beast, DRAGON_MARGIN - beast.bounds[0],
                      (BASE_TOP + DRAGON_OVERLAP) - beast.bounds[3])
    rings = to_rings(beast.intersection(box(-BIG, -BIG, BIG, BASE_TOP)))

    base = cut_box(flatten(paths[('pawn', variant)]), y0=BASE_TOP)
    neck = [p for ring in rings for p in ring if p[1] >= BASE_TOP - 8]
    if neck and base:
        across = min(n[0] for n in neck) - span(base)[0] + DRAGON_BASE_NUDGE
        base = move_polygons(base, lambda p: (p[0] + across, p[1]))

    if DEBUG:
        print('  scale', round(scale, 2), 'beast', [round(v) for v in span(rings)],
              'base', [round(v) for v in span(base)])

    if variant == 'outline':
        return fill(to_path(base)) + stroke(to_path(rings))
    return fill(to_path(base) + to_path(rings))

def fill(path):
    return f'<path d="{path}" />'


def stroke(path, width=STROKE):
    return (f'<path d="{path}" style="fill:none;stroke:currentColor;'
            f'stroke-width:{width};stroke-linejoin:round;stroke-linecap:round" />')


def drop_subpath(path, inside):
    """Removes whole subpaths that lie within a box, e.g. the queen's dot."""
    x0, y0, x1, y1 = inside
    kept = []
    for part in [p for p in re.split(r'(?=M)', path) if p.strip()]:
        values = [float(v) for v in re.findall(r'-?\d+\.?\d*', part)]
        xs, ys = values[0::2], values[1::2]
        if min(xs) >= x0 and min(ys) >= y0 and max(xs) <= x1 and max(ys) <= y1:
            continue
        kept.append(part)
    return ''.join(kept)


def build(paths):
    """Every symbol body, keyed by symbol id."""
    symbols = {}
    for name in STANDARD:
        for variant in VARIANTS:
            symbols[f'piece-{name}-{variant}'] = fill(paths[(name, variant)])

    for variant in VARIANTS:
        outlined = variant == 'outline'

        # Unicorn: the knight, with a horn drawn out of its own outline.
        symbols[f'piece-unicorn-{variant}'] = fill(extrude_horn(paths[('knight', variant)]))

        # Royal queen: the queen wearing the king's cross instead of its dot.
        without_dot = drop_subpath(paths[('queen', variant)], (180, 0, 340, 130))
        symbols[f'piece-royal-queen-{variant}'] = fill(without_dot) + fill(rounded_plus())

        # Common king: the king with its cross cut away, wearing the queen's dot.
        headless = cut_box(flatten(paths[('king', variant)]), y0=CROSS_BOTTOM)
        symbols[f'piece-common-king-{variant}'] = (
            fill(to_path(headless))
            + fill(circle(DOT_CENTRE[0], DOT_CENTRE[1], DOT_RADIUS[variant])))

        # Brawn: the pawn, with a stud on each side of its collar.
        studs = ''.join(circle(x, STUD_Y, STUD_RADIUS) for x in STUD_X)
        symbols[f'piece-brawn-{variant}'] = (
            fill(paths[('pawn', variant)])
            + (stroke(studs) if outlined else fill(studs)))

        # Princess: the rook's left half against the bishop's right half. Both are
        # drawn on the same baseline to begin with, so nothing needs stretching.
        left = cut_box(flatten(paths[('rook', variant)]), x1=MIDDLE)
        right = cut_box(flatten(paths[('bishop', variant)]), x0=MIDDLE)
        symbols[f'piece-princess-{variant}'] = fill(to_path(left) + to_path(right))

        symbols[f'piece-dragon-{variant}'] = dragon(paths, variant)

    return symbols


def main():
    symbols = build(load())
    lines = [
        '<!-- Generated by tools/build-pieces.py; do not edit by hand. -->',
        '<!-- Standard outlines from Font Awesome Free 7.1.0, CC BY 4.0, see the',
        '     LICENSE in src/assets/fontawesome-7.1.0. -->',
        '<svg xmlns="http://www.w3.org/2000/svg" style="display: none" aria-hidden="true">',
    ]
    for name in sorted(symbols):
        lines.append(f'\t<symbol id="{name}" viewBox="0 0 {WIDTH} {HEIGHT}">')
        lines.append(f'\t\t{symbols[name]}')
        lines.append('\t</symbol>')
    lines.append('</svg>')
    with open(OUTPUT, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write('\n'.join(lines) + '\n')
    print(f'wrote {OUTPUT} with {len(symbols)} symbols')


if __name__ == '__main__':
    main()
