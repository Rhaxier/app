"""Traces the walls of the school layout PDF into lines for the map to draw.

extract.py turns the plan into rooms and corridors, which is what routing
needs, but it merges open areas (the central hall and its side bays, for
example) into a few big corridor shapes, so the walls between them are lost.
This script keeps those walls: it takes the black lines of each page, thins
them to one-pixel centre lines, follows them into polylines, simplifies them,
and moves them onto the shared coordinates with the floor transforms that
extract.py already worked out (report.json).

Three details, each found by the wall audit of 2026-11-17 (MAP_NOTES.md):
  * A line whose two ends meet (a circle, a box standing on its own) is split
    in two before it is simplified: rdp() collapses such a line to one point.
  * Gaps where walls meet. Black lettering is kept out by removing small thick
    blobs, but walls thicken where they meet too, so those blobs were cut out
    and the walls stopped short. The page is traced a second time with the
    blobs that belong to walls kept, and only the stretches of that second
    trace that run from one wall of the first trace to another are added.
    Stretches with a free end (corner tips, stubs, letters touching a wall)
    are left out, so nothing else changes.
  * A line is kept when any part of it lies within the floor's width: the
    roofs of lower floors, drawn on the upper pages, reach further out than
    the rooms.
Pieces the tracing cannot see (a wall hidden under room-name text) are added
by hand from walls_patch.json.

Run (one-off, after extract.py, only when the PDF changes; see MAP_NOTES.md):
    python tools/map-extract/walls.py

Inputs:  map-inputs/layout.pdf, tools/map-extract/report.json,
         src/features/map/nav/data/geometry.json (where each floor's building is),
         tools/map-extract/walls_patch.json (wall pieces added by hand)
Output:  src/features/map/nav/data/walls.json   { "<floor>": [[x0, y0, x1, y1, ...], ...] }
"""
import json
import os
import sys

if "--deps" in sys.argv:  # optional folder holding the pip packages
    sys.path.insert(0, sys.argv[sys.argv.index("--deps") + 1])

import cv2
import numpy as np
from skimage.morphology import skeletonize

sys.path.insert(0, os.path.dirname(__file__))
from extract import FLOORS, OUT_DIR, REPORT, load_pages, rdp, thin  # noqa: E402

PATCH = os.path.join(os.path.dirname(__file__), "walls_patch.json")

MIN_LENGTH = 12  # px; shorter strokes are specks and letter fragments
SIMPLIFY = 1.5  # px; how far a simplified line may stray from the traced one
MARGIN = 40  # px around a floor's rooms and corridors; lines further out are the page's frame
MIN_CLOSED = 15  # px; a closed shape smaller than this across is a letter ("o", "e" are 7 px), not a wall
MIN_BRIDGE = 6  # px; dropped pieces spanning less than this between two walls are invisible
WALL_EXTENT = 60  # px; a black shape at least this long is wall (letters are under 40 px)


def wall_mask(rgb, keep_wall_blobs=False):
    """Black and dark grey lines: the walls. Dark blue room names are left out (as in extract.py).

    keep_wall_blobs: keep small thick blobs that are part of a wall-sized black shape (where
    walls meet), instead of removing every small thick blob as lettering.
    """
    r, g, b = [rgb[:, :, i].astype(np.int32) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    dark = ((mx < 105) & (b - np.maximum(r, g) < 40)) | ((mx < 165) & (mx - mn < 45))
    # Big filled black shapes (staircase bars, the steps at the entrance) stay; only
    # remove what is too thick to be a line *and* small, which is black lettering.
    letters = dark & ~thin(dark, k=5)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(letters.astype(np.uint8), connectivity=8)
    small = np.zeros(n, bool)
    small[1:] = stats[1:, cv2.CC_STAT_AREA] < 60
    if not keep_wall_blobs:
        return dark & ~small[lab]
    # A small thick blob is lettering only when the black shape it is part of is letter-sized.
    dn, dlab, dstats, _ = cv2.connectedComponentsWithStats(dark.astype(np.uint8), connectivity=8)
    wall_sized = np.zeros(dn, bool)
    wall_sized[1:] = np.maximum(dstats[1:, cv2.CC_STAT_WIDTH], dstats[1:, cv2.CC_STAT_HEIGHT]) >= WALL_EXTENT
    part_of = np.zeros(n, np.int32)
    part_of[lab[letters]] = dlab[letters]
    lettering = small & ~wall_sized[part_of]
    lettering[0] = False
    return dark & ~lettering[lab]


def trace(skeleton):
    """Follows a one-pixel skeleton into polylines that start and end at line ends or junctions."""
    H, W = skeleton.shape
    on = skeleton.astype(np.uint8)
    count = cv2.filter2D(on, -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT) - on
    steps = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

    def nbrs(y, x):
        for dy, dx in steps:
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and on[yy, xx]:
                yield yy, xx

    used = set()  # pixel pairs already walked
    lines = []
    ys, xs = np.nonzero(on)
    nodes = [(y, x) for y, x in zip(ys.tolist(), xs.tolist()) if count[y, x] != 2]
    node_set = set(nodes)

    def walk(start, nxt):
        path = [start, nxt]
        used.add((start, nxt))
        used.add((nxt, start))
        prev, cur = start, nxt
        while cur not in node_set:
            options = [p for p in nbrs(*cur) if p != prev and (cur, p) not in used]
            if not options:
                break
            prev, cur = cur, options[0]
            used.add((prev, cur))
            used.add((cur, prev))
            path.append(cur)
        return path

    for node in nodes:
        for nxt in nbrs(*node):
            if (node, nxt) not in used:
                lines.append(walk(node, nxt))
    # Closed loops with no junction on them (a round column, say).
    for y, x in zip(ys.tolist(), xs.tolist()):
        if (y, x) in node_set:
            continue
        for nxt in nbrs(y, x):
            if ((y, x), nxt) not in used:
                lines.append(walk((y, x), nxt))
                break
    return lines


def simplify(path):
    """rdp() on a traced path (y, x pixels), keeping closed shapes whole.

    rdp() measures each point's distance from the straight line between the
    path's two ends. When the ends meet there is no such line, and the whole
    shape comes back as one point. A closed shape is split at its point
    farthest from the start, and each half is simplified on its own. Small
    closed shapes are letters, and are left as they were.
    """
    pts = [(x, y) for y, x in path]
    simple = rdp(pts, SIMPLIFY)
    xs, ys = [x for x, _ in pts], [y for _, y in pts]
    closed = abs(pts[0][0] - pts[-1][0]) <= 1 and abs(pts[0][1] - pts[-1][1]) <= 1
    if closed and len(simple) == 2 and len(pts) > 3 and max(max(xs) - min(xs), max(ys) - min(ys)) >= MIN_CLOSED:
        far = max(range(len(pts)), key=lambda k: (pts[k][0] - pts[0][0]) ** 2 + (pts[k][1] - pts[0][1]) ** 2)
        simple = rdp(pts[: far + 1], SIMPLIFY)[:-1] + rdp(pts[far:], SIMPLIFY)
    return simple


def bridges(short_paths, long_paths, shape):
    """The short pieces that join two kept walls (where walls meet), as paths.

    Short pieces are grouped where they touch; a group counts when it reaches
    MIN_BRIDGE pixels across and touches kept walls in two separate places.
    Pieces that touch one wall only (corner tips, stubs, letters touching a
    wall) stay out.
    """
    H, W = shape
    kept = np.zeros((H, W), np.uint8)
    for path in long_paths:
        for y, x in path:
            kept[y, x] = 1
    short = np.zeros((H, W), np.uint8)
    for path in short_paths:
        for y, x in path:
            short[y, x] = 1
    only = ((short > 0) & (kept == 0)).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(only, connectivity=8)
    near_kept = cv2.dilate(kept, np.ones((3, 3), np.uint8)) > 0
    joining = np.zeros(n, bool)
    for k in range(1, n):
        x, y, w, h, _ = [int(v) for v in stats[k]]
        if max(w, h) < MIN_BRIDGE:
            continue
        touch = (lab[y : y + h, x : x + w] == k) & near_kept[y : y + h, x : x + w]
        joining[k] = cv2.connectedComponents(touch.astype(np.uint8))[0] - 1 >= 2
    return [path for path in short_paths if any(joining[lab[y, x]] for y, x in path if lab[y, x])]


def gap_fills(candidates, walls, shape, leave_out=()):
    """Stretches of the candidate paths that fill a gap between walls.

    Candidate pixels within 2 px of a wall are already drawn; the others are
    "off" the walls. Two ways to fill a gap, both only ever from wall to wall:
      * along one path: a run of off pixels with a wall (within 4 px) at both
        of its ends, such as a wall that stopped short of the next one;
      * as a group: off pixels grouped where they touch, kept when the group
        reaches walls in two or more separate places, such as the middle of a
        junction where three walls meet and every branch stopped short.
    Runs and groups that reach one wall only (corner tips, stubs, letters
    touching a wall) are not kept, nor anything in a leave_out box
    (x0, y0, x1, y1).
    """
    H, W = shape
    drawn = np.zeros((H, W), np.uint8)
    for path in walls:
        for y, x in path:
            drawn[y, x] = 1
    on_wall = cv2.dilate(drawn, np.ones((5, 5), np.uint8)) > 0
    by_wall = cv2.dilate(drawn, np.ones((9, 9), np.uint8)) > 0
    off = np.zeros((H, W), np.uint8)
    for path in candidates:
        for y, x in path:
            if not on_wall[y, x]:
                off[y, x] = 1
    n, lab, stats, _ = cv2.connectedComponentsWithStats(off, connectivity=8)
    keep = np.zeros(n, bool)
    left_out = np.zeros(n, bool)
    for k in range(1, n):
        x, y, w, h, area = [int(v) for v in stats[k]]
        if any(x0 <= x + w and x <= x1 and y0 <= y + h and y <= y1 for x0, y0, x1, y1 in leave_out):
            left_out[k] = True
            continue
        group = lab[y : y + h, x : x + w] == k
        touch = group & by_wall[y : y + h, x : x + w]
        keep[k] = area >= 2 and cv2.connectedComponents(touch.astype(np.uint8))[0] - 1 >= 2
    fills = []
    for path in candidates:
        run, before = [], None
        for y, x in path:
            if off[y, x]:
                run.append((y, x))
                continue
            if run:
                group = lab[run[0]]
                if not left_out[group] and (keep[group] or (before is not None and by_wall[before])):
                    # From the wall pixel before to the wall pixel after, so the fill meets both.
                    fills.append(([before] if before else []) + run + [(y, x)])
                run = []
            before = (y, x)
        if run:
            group = lab[run[0]]
            ends_by_walls = before is not None and by_wall[run[-1]]
            if not left_out[group] and (keep[group] or ends_by_walls):
                fills.append(([before] if before else []) + run)
    return fills


def main():
    pages = load_pages()
    transforms = json.load(open(REPORT))["transforms"]
    regions = json.load(open(os.path.join(OUT_DIR, "geometry.json")))["regions"]
    patch_file = json.load(open(PATCH))
    patch, unchanged = patch_file["lines"], patch_file["unchanged"]
    out = {}
    for i, (fid, _) in enumerate(FLOORS):
        t = transforms[fid]
        # How far the building reaches left and right on this floor: its rooms and corridors,
        # and the voids overlapping them (the roofs of the floors below, drawn on the upper
        # pages, reach further out than the rooms). The fields beside the building are voids
        # too, but they don't overlap it. Only the width is used.
        floor_regions = [r for r in regions if r["floor"] == fid]
        xs = [x for r in floor_regions if r["kind"] != "void" for x, _ in r["polygon"]]
        left, right = min(xs), max(xs)
        for r in floor_regions:
            vx = [x for x, _ in r["polygon"]]
            if r["kind"] == "void" and min(vx) <= right and max(vx) >= left:
                xs += vx
        left, right = min(xs) - MARGIN, max(xs) + MARGIN
        # The walls as first traced.
        skeleton = skeletonize(wall_mask(pages[i]))
        traced = [path for path in trace(skeleton) if len(path) >= MIN_LENGTH]
        # Traced again with the thick bits where walls meet kept; only the stretches that join
        # two walls of the first trace are added.
        again = trace(skeletonize(wall_mask(pages[i], keep_wall_blobs=True)))
        again_long = [path for path in again if len(path) >= MIN_LENGTH]
        again_short = [path for path in again if len(path) < MIN_LENGTH]
        candidates = again_long + bridges(again_short, again_long, skeleton.shape)
        leave_out = [tuple(area["page_box"]) for area in unchanged if area["floor"] == fid]
        joins = gap_fills(candidates, traced, skeleton.shape, leave_out)
        lines = []
        for path in traced + joins:
            pts = [(t["sx"] * x + t["tx"], t["sy"] * y + t["ty"]) for x, y in simplify(path)]
            if not any(left <= x <= right for x, _ in pts):
                continue
            lines.append([round(v, 1) for p in pts for v in p])
        for piece in patch:
            if piece["floor"] == fid:
                pts = [(t["sx"] * x + t["tx"], t["sy"] * y + t["ty"]) for x, y in piece["page"]]
                lines.append([round(v, 1) for p in pts for v in p])
        out[fid] = lines
        print(fid, len(lines), "lines,", sum(len(l) // 2 for l in lines), "points,", len(joins), "gaps filled")
    path = os.path.join(OUT_DIR, "walls.json")
    with open(path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print("wrote", path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()
