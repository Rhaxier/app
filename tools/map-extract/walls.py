"""Traces the walls of the school layout PDF into lines for the map to draw.

extract.py turns the plan into rooms and corridors, which is what routing
needs, but it merges open areas (the central hall and its side bays, for
example) into a few big corridor shapes, so the walls between them are lost.
This script keeps those walls: it takes the black lines of each page, thins
them to one-pixel centre lines, follows them into polylines, simplifies them,
and moves them onto the shared coordinates with the floor transforms that
extract.py already worked out (report.json).

Run (one-off, after extract.py, only when the PDF changes; see MAP_NOTES.md):
    python tools/map-extract/walls.py

Inputs:  map-inputs/layout.pdf, tools/map-extract/report.json,
         src/features/map/nav/data/geometry.json (where each floor's building is)
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

MIN_LENGTH = 12  # px; shorter strokes are specks and letter fragments
SIMPLIFY = 1.5  # px; how far a simplified line may stray from the traced one
MARGIN = 40  # px around a floor's rooms and corridors; lines further out are the page's frame


def wall_mask(rgb):
    """Black and dark grey lines: the walls. Dark blue room names are left out (as in extract.py)."""
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
    return dark & ~small[lab]


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


def main():
    pages = load_pages()
    transforms = json.load(open(REPORT))["transforms"]
    regions = json.load(open(os.path.join(OUT_DIR, "geometry.json")))["regions"]
    out = {}
    for i, (fid, _) in enumerate(FLOORS):
        t = transforms[fid]
        # How far this floor's rooms and corridors reach left and right (voids include
        # page margins). Only the width is used: the roofs of the floors below, drawn on
        # the upper pages, reach further down than the rooms do.
        xs = [x for r in regions if r["floor"] == fid and r["kind"] != "void" for x, _ in r["polygon"]]
        left, right = min(xs) - MARGIN, max(xs) + MARGIN
        skeleton = skeletonize(wall_mask(pages[i]))
        lines = []
        for path in trace(skeleton):
            if len(path) < MIN_LENGTH:
                continue
            pts = rdp([(x, y) for y, x in path], SIMPLIFY)
            pts = [(t["sx"] * x + t["tx"], t["sy"] * y + t["ty"]) for x, y in pts]
            if not all(left <= x <= right for x, _ in pts):
                continue
            lines.append([round(v, 1) for p in pts for v in p])
        out[fid] = lines
        print(fid, len(lines), "lines,", sum(len(l) // 2 for l in lines), "points")
    path = os.path.join(OUT_DIR, "walls.json")
    with open(path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print("wrote", path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()
