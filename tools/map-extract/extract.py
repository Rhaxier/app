"""Traces the school layout PDF into the indoor-navigation geometry file.

The PDF is four scanned pages (one per floor), so there is no vector data to
read. This script works on the pixels instead:

  1. Walls (black), door marks (thin green) and red corridor lines are found by colour.
  2. Everything the walls enclose becomes a "region" (a room or a corridor).
  3. Each door mark joins the two regions on either side of it.
  4. Rooms with no drawn door get an inferred one on the wall facing their corridor.
  5. Corridors get a centre-line graph; rooms get one node joined to their doors.
  6. The four pages are drawn at different scales, so floors 1-3 are stretched
     onto the ground floor's coordinates using the staircase symbols as landmarks.

Run (one-off, only when the PDF changes; see MAP_NOTES.md):
    pip install pymupdf numpy scipy opencv-python-headless scikit-image
    python tools/map-extract/extract.py

Inputs:  map-inputs/layout.pdf, tools/map-extract/labels.json
Outputs: src/features/map/nav/data/geometry.json
         src/features/map/nav/data/assignments.csv   (names printed on the PDF)
         tools/map-extract/report.json               (tracing details for review)
"""
import json
import math
import os
import sys

if "--deps" in sys.argv:  # optional folder holding the pip packages
    sys.path.insert(0, sys.argv[sys.argv.index("--deps") + 1])

import cv2
import numpy as np
import pymupdf
from skimage.morphology import skeletonize

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PDF = os.path.join(ROOT, "map-inputs", "layout.pdf")
LABELS = os.path.join(os.path.dirname(__file__), "labels.json")
OUT_DIR = os.path.join(ROOT, "src", "features", "map", "nav", "data")
REPORT = os.path.join(os.path.dirname(__file__), "report.json")

FLOORS = [("G", "Ground Floor"), ("1", "First Floor"), ("2", "Second Floor"), ("3", "Third Floor")]
# The school says corridors are 2.5 m wide. On the plan they measure about 54 units wall to wall.
METRES_PER_UNIT = 0.046

MIN_REGION = 500  # px; smaller enclosed specks are text holes and door recesses
GROW = 5  # walls are thickened by 2 px each side before labelling, to close hairline gaps
CORRIDOR_MIN_AREA = 6000  # unlabelled regions at least this big, with a door, count as corridor
SPUR = 38  # centre-line side branches shorter than this (px) are trimmed


# ---------------------------------------------------------------- step 1-2: pixels to regions
def load_pages():
    doc = pymupdf.open(PDF)
    pages = []
    for page in doc:
        xref = page.get_images(full=True)[0][0]
        pix = pymupdf.Pixmap(doc, xref)
        if pix.n > 3:
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        pages.append(arr[:, :, :3].copy())  # RGB
    return pages


def thin(mask, k=11):
    """Keeps only the parts of a mask thinner than k px (lines, not filled rooms or big text)."""
    m = mask.astype(np.uint8)
    opened = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
    return (m == 1) & (opened == 0)


def segment(rgb):
    r, g, b = [rgb[:, :, i].astype(np.int32) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    # Label text is dark blue; it must not count as wall or it splits small rooms in two.
    dark = ((mx < 105) & (b - np.maximum(r, g) < 40)) | ((mx < 165) & (mx - mn < 45))
    green = thin((g > 150) & (r < 110) & (b < 110) & (g - np.maximum(r, b) > 60))
    red = thin((r > 170) & (g < 110) & (b < 110))
    barrier = dark | green | red
    free = 1 - cv2.dilate(barrier.astype(np.uint8), np.ones((GROW, GROW), np.uint8))
    n, lab, stats, cent = cv2.connectedComponentsWithStats(free, connectivity=4)
    H, W = lab.shape
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])).tolist())
    regions = {}
    recess = np.zeros((H, W), bool)  # thin slivers on a room's corridor side: door recesses
    for i in range(1, n):
        x, y, w, h, a = [int(v) for v in stats[i]]
        if a < MIN_REGION:
            if a >= 150 and max(w, h) >= 30:
                recess[y : y + h, x : x + w] |= lab[y : y + h, x : x + w] == i
            continue
        regions[i] = dict(id=i, area=a, bbox=(x, y, w, h), c=(float(cent[i][0]), float(cent[i][1])), outside=i in border, doors=[])
    marks = []
    for kind, mask in (("door", green), ("opening", red)):
        dn, dl, ds, dc = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
        for j in range(1, dn):
            x, y, w, h, a = [int(v) for v in ds[j]]
            if a < 25:
                continue
            x0, y0, x1, y1 = max(0, x - 8), max(0, y - 8), min(W, x + w + 8), min(H, y + h + 8)
            near = cv2.dilate((dl[y0:y1, x0:x1] == j).astype(np.uint8), np.ones((13, 13), np.uint8)) > 0
            ids, counts = np.unique(lab[y0:y1, x0:x1][near], return_counts=True)
            sides = sorted([(int(c), int(t)) for t, c in zip(ids, counts) if t in regions and c >= 12], reverse=True)
            if len(sides) >= 3:
                # A mark at a wall junction touches three regions. Doors lead off the corridor, so pair
                # the biggest region (the corridor) with whichever other side the mark touches most.
                by_area = sorted(sides, key=lambda side: -regions[side[1]]["area"])
                if regions[by_area[0][1]]["area"] >= 4 * regions[by_area[1][1]]["area"]:
                    sides = [by_area[0]] + [side for side in sides if side is not by_area[0]]
            if len(sides) >= 2:  # a mark touching only one region is text or decoration
                marks.append(dict(kind=kind, x=float(dc[j][0]), y=float(dc[j][1]), a=sides[0][1], b=sides[1][1]))
    # Staircase symbol: a thick black bar standing free inside a box.
    bars = []
    bn, bl, bs, bc = cv2.connectedComponentsWithStats((mx < 90).astype(np.uint8), connectivity=8)
    for i in range(1, bn):
        x, y, w, h, a = [int(v) for v in bs[i]]
        if not (200 < a < 4000):
            continue
        ys, xs = np.nonzero(bl[y : y + h, x : x + w] == i)
        (cx, cy), (rw, rh), _ = cv2.minAreaRect(np.stack([xs, ys], 1).astype(np.float32))
        long_side, short_side = max(rw, rh), min(rw, rh)
        if short_side < 4.5 or short_side > 22 or long_side < 40 or long_side > 170 or a / (long_side * short_side + 1) < 0.7:
            continue
        patch = lab[max(0, y - 10) : y + h + 10, max(0, x - 10) : x + w + 10].ravel()
        patch = patch[patch > 0]
        if len(patch) == 0:
            continue
        rid = int(np.bincount(patch).argmax())
        if rid in regions and not regions[rid]["outside"]:
            bars.append(dict(x=cx + x, y=cy + y, region=rid))
    return lab, regions, marks, bars, recess


# ---------------------------------------------------------------- step 5: corridor centre-lines
def rdp(points, eps):
    """Ramer-Douglas-Peucker line simplification."""
    if len(points) < 3:
        return points
    (x0, y0), (x1, y1) = points[0], points[-1]
    dx, dy = x1 - x0, y1 - y0
    norm = math.hypot(dx, dy) or 1.0
    best, at = 0.0, 0
    for i in range(1, len(points) - 1):
        d = abs(dy * (points[i][0] - x0) - dx * (points[i][1] - y0)) / norm
        if d > best:
            best, at = d, i
    if best <= eps:
        return [points[0], points[-1]]
    return rdp(points[: at + 1], eps)[:-1] + rdp(points[at:], eps)


def centre_line(mask):
    """Skeleton of a corridor mask as (nodes, edges). Coordinates are local to the mask."""
    smooth = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    sk = skeletonize(smooth > 0)
    pix = set(zip(*np.nonzero(sk)))  # (y, x)
    if not pix:
        return [], []

    def nbrs(p):
        y, x = p
        return [(y + dy, x + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (y + dy, x + dx) in pix]

    deg = {p: len(nbrs(p)) for p in pix}
    special = {p for p in pix if deg[p] != 2}
    if not special:  # a closed loop with no branches: start anywhere (deterministically)
        special = {min(pix)}
    # Neighbouring junction pixels are merged into one node.
    node_of, nodes = {}, []
    for p in sorted(special):
        if p in node_of:
            continue
        stack, group = [p], []
        node_of[p] = len(nodes)
        while stack:
            q = stack.pop()
            group.append(q)
            for m in nbrs(q):
                if m in special and m not in node_of:
                    node_of[m] = len(nodes)
                    stack.append(m)
        nodes.append((sum(q[1] for q in group) / len(group), sum(q[0] for q in group) / len(group)))
    paths, seen = [], set()
    for p in sorted(special):
        for start in nbrs(p):
            if start in special:
                if node_of[start] != node_of[p] and (start, p) not in seen:
                    seen.add((p, start))
                    paths.append((node_of[p], node_of[start], [p, start]))
                continue
            if (p, start) in seen:
                continue
            path, prev, cur = [p, start], p, start
            while cur not in special:
                nxt = [m for m in nbrs(cur) if m != prev and m not in nbrs(prev)] or [m for m in nbrs(cur) if m != prev]
                nxt = sorted(nxt, key=lambda m: (m not in special, abs(m[0] - cur[0]) + abs(m[1] - cur[1])))
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
                path.append(cur)
            if cur in special:
                seen.add((cur, path[-2]))
                paths.append((node_of[p], node_of[cur], path))

    def plen(path):
        return sum(math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]) for i in range(1, len(path)))

    # Trim short dead-end twigs (skeleton noise at corners), repeating until none are left.
    while True:
        degree = {}
        for a, b, _ in paths:
            degree[a] = degree.get(a, 0) + 1
            degree[b] = degree.get(b, 0) + 1
        keep = [p for p in paths if not ((degree[p[0]] == 1 or degree[p[1]] == 1) and plen(p[2]) < SPUR and len(paths) > 1)]
        if len(keep) == len(paths):
            break
        paths = keep
    out_nodes, out_edges, index = [], [], {}

    def node(pt):
        key = (round(pt[0], 1), round(pt[1], 1))
        if key not in index:
            index[key] = len(out_nodes)
            out_nodes.append(key)
        return index[key]

    for a, b, path in paths:
        line = [nodes[a]] + [(q[1], q[0]) for q in path[1:-1]] + [nodes[b]]
        line = rdp(line, 4.0)
        for i in range(1, len(line)):
            u, v = node(line[i - 1]), node(line[i])
            if u != v:
                out_edges.append((u, v))
    return out_nodes, sorted(set((min(u, v), max(u, v)) for u, v in out_edges))


# ---------------------------------------------------------------- main per-floor tracing
def inner_point(mask):
    """The point deepest inside a mask (safe for labels even in L-shaped rooms)."""
    dist = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5)
    y, x = np.unravel_index(int(dist.argmax()), dist.shape)
    return float(x), float(y)


def trace_floor(fi, rgb, labels):
    lab, regions, marks, bars, recess = segment(rgb)
    H, W = lab.shape
    notes = []

    def region_at(pt):
        x, y = int(round(pt[0])), int(round(pt[1]))
        rid = int(lab[y, x]) if 0 <= y < H and 0 <= x < W else 0
        if rid not in regions:  # the point sits on a letter or a line: take the region around it
            patch = lab[max(0, y - 22) : y + 23, max(0, x - 22) : x + 23].ravel()
            patch = patch[patch > 0]
            rid = int(np.bincount(patch).argmax()) if len(patch) else 0
        return rid if rid in regions else None

    def region_at_exact(pt):
        x, y = int(round(pt[0])), int(round(pt[1]))
        return int(lab[y, x]) if 0 <= y < H and 0 <= x < W else 0

    # --- names and manual kinds from labels.json (keyed by a point inside the region)
    for r in regions.values():
        r.update(kind=None, name=None, type=None, stair=False)
    for bar in bars:
        regions[bar["region"]]["stair"] = True
    for entry in labels.get("rooms", []):
        rid = region_at(entry["at"])
        if rid is None:
            notes.append(f"label {entry['name']!r} at {entry['at']} hits no region")
            continue
        if regions[rid]["name"]:
            regions[rid]["name"] += " / " + entry["name"]
        else:
            regions[rid].update(name=entry["name"], type=entry.get("type", "other"))
    forced = {}
    for kind in ("void", "corridor", "room", "stairwell"):
        for pt in labels.get(kind, []):
            rid = region_at(pt)
            if rid is None:
                notes.append(f"{kind} override at {pt} hits no region")
            else:
                forced[rid] = kind

    # --- doors drawn on the plan
    doors = []
    for m in marks:
        a, b = regions[m["a"]], regions[m["b"]]
        if a["outside"] and b["outside"]:
            continue
        if a["outside"]:
            a, b = b, a
        doors.append(dict(kind=m["kind"], x=m["x"], y=m["y"], a=a["id"], b=b["id"]))
        a["doors"].append(len(doors) - 1)
        b["doors"].append(len(doors) - 1)

    # --- kinds
    for r in regions.values():
        if r["outside"]:
            r["kind"] = "outside"
        elif r["id"] in forced:
            r["kind"] = forced[r["id"]]
        elif r["stair"] and not r["name"]:
            r["kind"] = "stairwell"
        elif r["name"]:
            r["kind"] = "room"
        elif r["doors"]:
            r["kind"] = "corridor" if (r["area"] >= CORRIDOR_MIN_AREA or len(r["doors"]) >= 3) else "room"
        else:
            r["kind"] = "pending"  # unlabelled and no drawn door: decided below

    # --- inferred doors for rooms that have no door into walkable space
    def neighbours(r, reach=9):
        """Regions across a wall from r: id -> (shared-wall pixels, midpoint, touches a door recess)."""
        kernel = np.ones((2 * reach + 1, 2 * reach + 1), np.uint8)
        x, y, w, h = r["bbox"]
        x0, y0, x1, y1 = max(0, x - 45), max(0, y - 45), min(W, x + w + 45), min(H, y + h + 45)
        own = (lab[y0:y1, x0:x1] == r["id"]).astype(np.uint8)
        sub = lab[y0:y1, x0:x1]
        # Door recesses lie between the room and its corridor. Count the ones touching this room
        # as part of it, so the corridor behind them is seen as a neighbour.
        rn, rl = cv2.connectedComponents(recess[y0:y1, x0:x1].astype(np.uint8), connectivity=8)
        touching = np.unique(rl[(cv2.dilate(own, kernel) > 0) & (rl > 0)])
        mine = np.isin(rl, touching) & (rl > 0)
        grown = (own > 0) | mine
        ring = (cv2.dilate(grown.astype(np.uint8), kernel) > 0) & ~grown & (sub != r["id"])
        rec = cv2.dilate(mine.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
        found = {}
        for other in np.unique(sub[ring]):
            other = int(other)
            if other == 0 or other == r["id"] or other not in regions:
                continue
            band = (ring & (sub == other)).astype(np.uint8)
            cn, cl, cs, cc = cv2.connectedComponentsWithStats(band, connectivity=8)
            if cn < 2:
                continue
            best = 1 + int(np.argmax(cs[1:, 4]))
            touches = bool((rec & (cl == best)).any())
            if touches:  # put the door at the recess, not at the middle of the wall
                ys, xs = np.nonzero(rec & (cl == best))
                mid = (float(xs.mean()) + x0, float(ys.mean()) + y0)
            else:
                mid = (float(cc[best][0]) + x0, float(cc[best][1]) + y0)
            found[other] = (int(cs[best, 4]), mid, touches)
        return found

    def has_walkable_door(r):
        return any(regions[d["b"] if d["a"] == r["id"] else d["a"]]["kind"] in ("corridor", "room", "stairwell") for d in (doors[i] for i in r["doors"]))

    inferred = 0
    room_to_room = []

    def add_inferred(r, other, mid):
        nonlocal inferred
        if regions[other]["kind"] == "pending":
            regions[other]["kind"] = "corridor"
        doors.append(dict(kind="inferred", x=mid[0], y=mid[1], a=r["id"], b=other))
        r["doors"].append(len(doors) - 1)
        regions[other]["doors"].append(len(doors) - 1)
        inferred += 1

    def best_neighbour(r, kinds, allowed=None, reaches=(9, 15)):
        """The neighbour to put an inferred door to: a door recess wins, then a known corridor, then the longest wall."""
        for reach in reaches:  # later tries reach across double-drawn walls
            options = [(k, v) for k, v in neighbours(r, reach).items() if regions[k]["kind"] in kinds and (allowed is None or allowed(k)) and v[0] >= 25]
            if options:
                other, (shared, mid, touches) = max(options, key=lambda o: (o[1][2], regions[o[0]]["kind"] == "corridor", o[1][0]))
                return other, mid
        return None

    order = sorted((r for r in regions.values() if r["kind"] in ("room", "stairwell")), key=lambda r: (not r["name"], r["c"][1], r["c"][0]))
    for r in order:
        if has_walkable_door(r) or not (r["name"] or r["stair"]):
            continue
        found = best_neighbour(r, ("corridor", "pending"))
        if found:
            add_inferred(r, *found)
    for r in regions.values():
        if r["kind"] == "pending":
            r["kind"] = "void"

    # Doors the school confirmed but the plan does not draw: pairs of points, one in each room.
    for a_pt, b_pt in labels.get("doors", []):
        ra, rb = region_at(a_pt), region_at(b_pt)
        found = None
        if ra is not None and rb is not None and ra != rb:
            found = best_neighbour(regions[ra], ("room", "corridor", "stairwell"), lambda k: k == rb, reaches=(9, 15, 25, 40))
        if found:
            add_inferred(regions[ra], *found)
        elif ra is not None and rb is not None and ra != rb:
            # Not side by side (a lobby or cupboard lies between): put the door where the
            # straight line from the first point to the second leaves the first room.
            steps = int(math.hypot(b_pt[0] - a_pt[0], b_pt[1] - a_pt[1]))
            inside = [t for t in range(steps + 1) if region_at_exact((a_pt[0] + (b_pt[0] - a_pt[0]) * t / steps, a_pt[1] + (b_pt[1] - a_pt[1]) * t / steps)) == ra]
            t = (inside[-1] + 4) / steps
            add_inferred(regions[ra], rb, (a_pt[0] + (b_pt[0] - a_pt[0]) * t, a_pt[1] + (b_pt[1] - a_pt[1]) * t))
        else:
            notes.append(f"confirmed door {a_pt}-{b_pt} could not be placed")

    # Second pass: groups of rooms that still cannot reach the floor's main walkable area.
    def groups():
        parent = {r["id"]: r["id"] for r in regions.values() if r["kind"] in ("room", "corridor", "stairwell")}

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        for d in doors:
            if d["a"] in parent and d["b"] in parent:
                parent[find(d["a"])] = find(d["b"])
        out = {}
        for i in parent:
            out.setdefault(find(i), []).append(i)
        return out

    for _ in range(6):
        gs = groups()
        if not gs:
            break
        main = set(max(gs.values(), key=lambda g: sum(regions[i]["area"] for i in g if regions[i]["kind"] == "corridor")))
        changed = False
        for g in sorted(gs.values(), key=lambda g: min(g)):
            if main & set(g) or not any(regions[i]["name"] for i in g):
                continue
            # A group with its own stair symbol is left alone: it is reached by those stairs.
            if any(regions[i]["kind"] == "stairwell" for i in g):
                continue
            for i in sorted(g, key=lambda i: (not regions[i]["name"], -regions[i]["area"])):
                found = best_neighbour(regions[i], ("corridor",), lambda k: k in main, reaches=(9, 15, 25, 40))
                kind = "corridor"
                if not found:
                    found = best_neighbour(regions[i], ("room",), lambda k: k in main)
                    kind = "room"
                if found:
                    add_inferred(regions[i], *found)
                    if kind == "room":
                        room_to_room.append(f"{regions[i]['name'] or 'unnamed'} -> {regions[found[0]]['name'] or 'unnamed'}")
                    changed = True
                    break
        if not changed:
            break
    gs = groups()
    if gs:
        main = set(max(gs.values(), key=lambda g: sum(regions[i]["area"] for i in g if regions[i]["kind"] == "corridor")))
        for g in gs.values():
            if main & set(g):
                continue
            names = [regions[i]["name"] for i in g if regions[i]["name"]]
            if not names:  # nameless closed boxes nobody can reach: drop them
                for i in g:
                    regions[i]["kind"] = "void"
            else:
                stair = any(regions[i]["kind"] == "stairwell" for i in g)
                notes.append(f"cut off from the main area ({'has its own stair symbol' if stair else 'NO stair symbol'}): {', '.join(names)}")
    if room_to_room:
        notes.append("inferred doors through another room: " + "; ".join(room_to_room))
    walkable = {r["id"] for r in regions.values() if r["kind"] in ("room", "corridor", "stairwell")}
    doors = [d for d in doors if d["a"] in walkable and (d["b"] in walkable or regions[d["b"]]["kind"] == "outside")]

    # --- shapes and graph
    out_regions, nodes, edges = {}, [], []

    def add_node(x, y, kind, region=None, door=None):
        nodes.append(dict(x=x, y=y, kind=kind, region=region, door=door))
        return len(nodes) - 1

    def add_edge(a, b, door=None):
        if a != b:
            edges.append(dict(a=a, b=b, door=door))

    corridor_graph = {}
    for r in sorted(regions.values(), key=lambda r: r["id"]):
        if r["kind"] in ("outside",):
            continue
        x, y, w, h = r["bbox"]
        x0, y0 = max(0, x - 6), max(0, y - 6)
        own = (lab[y0 : y + h + 6, x0 : x + w + 6] == r["id"]).astype(np.uint8)
        fat = cv2.dilate(own, np.ones((9, 9), np.uint8))  # out to the middle of the wall
        contours, hierarchy = cv2.findContours(fat, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        outer, holes = None, []
        for contour, info in zip(contours, hierarchy[0]):
            poly = cv2.approxPolyDP(contour, 2.5, True).reshape(-1, 2)
            if len(poly) < 3:
                continue
            pts = [(float(px) + x0, float(py) + y0) for px, py in poly]
            if info[3] == -1:
                if outer is None or cv2.contourArea(contour) > outer[0]:
                    outer = (cv2.contourArea(contour), pts)
            elif cv2.contourArea(contour) > 1500:
                holes.append(pts)
        if outer is None:
            continue
        lx, ly = inner_point(own)
        out_regions[r["id"]] = dict(kind=r["kind"], name=r["name"], type=r["type"], stair=r["stair"], polygon=outer[1], holes=holes, labelAt=(lx + x0, ly + y0), area=r["area"])
        if r["kind"] in ("room", "stairwell"):
            r["node"] = add_node(lx + x0, ly + y0, "room", r["id"])
        elif r["kind"] == "corridor":
            cn, ce = centre_line(own)
            if not cn:
                cn, ce = [(lx, ly)], []
            ids = [add_node(px + x0, py + y0, "corridor", r["id"]) for px, py in cn]
            for u, v in ce:
                add_edge(ids[u], ids[v])
            corridor_graph[r["id"]] = dict(nodes=ids, mask=cv2.dilate(own, np.ones((7, 7), np.uint8)), origin=(x0, y0))

    def visible(graph, p, q):
        """True when the straight line p-q stays inside the corridor (ignoring the first steps through the doorway)."""
        mask, (ox, oy) = graph["mask"], graph["origin"]
        length = math.hypot(q[0] - p[0], q[1] - p[1])
        steps = max(2, int(length / 3))
        for s in range(steps + 1):
            t = s / steps
            if t * length < 14:
                continue
            xx, yy = int(round(p[0] + (q[0] - p[0]) * t - ox)), int(round(p[1] + (q[1] - p[1]) * t - oy))
            if not (0 <= yy < mask.shape[0] and 0 <= xx < mask.shape[1]) or not mask[yy, xx]:
                return False
        return True

    blocked = 0

    def attach(door_node, rid, door_index):
        """Joins a door to the corridor's centre-line at the nearest point it can see."""
        nonlocal blocked
        graph = corridor_graph[rid]
        members = set(graph["nodes"])
        p = (nodes[door_node]["x"], nodes[door_node]["y"])
        options = []
        for ei, e in enumerate(edges):
            if e["a"] in members and e["b"] in members and e["door"] is None:
                a, b = nodes[e["a"]], nodes[e["b"]]
                dx, dy = b["x"] - a["x"], b["y"] - a["y"]
                t = max(0.0, min(1.0, ((p[0] - a["x"]) * dx + (p[1] - a["y"]) * dy) / ((dx * dx + dy * dy) or 1.0)))
                q = (a["x"] + dx * t, a["y"] + dy * t)
                options.append((math.hypot(q[0] - p[0], q[1] - p[1]), ei, t, q))
        if not options:  # a corridor small enough to be a single node
            add_edge(door_node, graph["nodes"][0], door_index)
            return
        options.sort(key=lambda o: (o[0], o[1]))
        chosen = next((o for o in options[:25] if visible(graph, p, o[3])), None)
        if chosen is None:
            blocked += 1
            chosen = options[0]
        _, ei, t, q = chosen
        e = edges[ei]
        if t < 0.02:
            target = e["a"]
        elif t > 0.98:
            target = e["b"]
        else:  # split the corridor edge at the foot of the door
            target = add_node(q[0], q[1], "corridor", rid)
            graph["nodes"].append(target)
            old_b = e["b"]
            e["b"] = target
            add_edge(target, old_b)
        add_edge(door_node, target, door_index)

    for di, d in enumerate(doors):
        dn = add_node(d["x"], d["y"], "door", d["a"], di)
        for side in (d["a"], d["b"]):
            r = regions[side]
            if r["kind"] in ("room", "stairwell"):
                add_edge(dn, r["node"], di)
            elif r["kind"] == "corridor":
                attach(dn, side, di)
    # Named spots with no walls of their own (a lounge in a corridor, a lab bench area).
    places = []
    for entry in labels.get("places", []):
        rid = region_at(entry["at"])
        if rid is None or regions[rid]["kind"] not in ("room", "corridor", "stairwell"):
            notes.append(f"place {entry['name']!r} at {entry['at']} is not in a walkable region")
            continue
        pn = add_node(entry["at"][0], entry["at"][1], "place", rid)
        nodes[pn]["place"] = len(places)
        places.append(dict(x=entry["at"][0], y=entry["at"][1], region=rid, name=entry["name"], type=entry.get("type", "other")))
        if regions[rid]["kind"] == "corridor":
            attach(pn, rid, None)
        else:
            add_edge(pn, regions[rid]["node"])

    # Outdoor walks between buildings, given in labels.json as pairs of points near exterior doors.
    exterior = [i for i, nd in enumerate(nodes) if nd["kind"] == "door" and regions[doors[nd["door"]]["b"]]["kind"] == "outside"]
    for a, b in labels.get("outdoor", []):
        ends = [min(exterior, key=lambda i: math.hypot(nodes[i]["x"] - pt[0], nodes[i]["y"] - pt[1])) for pt in (a, b)] if exterior else []
        if len(ends) == 2 and ends[0] != ends[1]:
            edges.append(dict(a=ends[0], b=ends[1], door=None, tags=["outdoor"]))
        else:
            notes.append(f"outdoor link {a}-{b} found no exterior doors")
    notes.append(f"{inferred} inferred doors; {blocked} door-to-corridor links cross a wall corner")
    bars = [b for b in bars if b["region"] in out_regions]
    return dict(places=places, regions=out_regions, doors=doors, nodes=nodes, edges=edges, bars=bars, notes=notes, kinds={r["id"]: r["kind"] for r in regions.values()})


# ---------------------------------------------------------------- step 6: one coordinate system
def find_tower(rgb, approx):
    """Centre of the round tower on the east side, an extra landmark present on every page."""
    x0, y0 = int(approx[0]) - 220, int(approx[1]) - 220
    crop = rgb[y0 : y0 + 440, x0 : x0 + 440]
    grey = cv2.GaussianBlur(cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY), (5, 5), 0)
    circles = cv2.HoughCircles(grey, cv2.HOUGH_GRADIENT, dp=1, minDist=400, param1=120, param2=30, minRadius=40, maxRadius=120)
    if circles is None:
        return None
    cx, cy, _ = circles[0][0]
    return dict(x=float(cx) + x0, y=float(cy) + y0, region=None)


def fit_floor(bars, ref_bars, guess):
    """Least-squares x' = sx*x + tx, y' = sy*y + ty from matched staircase symbols."""
    sx, sy, tx, ty = guess
    pairs = []
    for _ in range(6):
        pairs = []
        for b in bars:
            px, py = sx * b["x"] + tx, sy * b["y"] + ty
            near = min(ref_bars, key=lambda r: math.hypot(r["x"] - px, r["y"] - py))
            if math.hypot(near["x"] - px, near["y"] - py) < 110:
                pairs.append((b, near))
        if len(pairs) < 3:
            break
        ax = np.array([[b["x"], 1.0] for b, _ in pairs])
        sx, tx = np.linalg.lstsq(ax, np.array([r["x"] for _, r in pairs]), rcond=None)[0]
        ay = np.array([[b["y"], 1.0] for b, _ in pairs])
        sy, ty = np.linalg.lstsq(ay, np.array([r["y"] for _, r in pairs]), rcond=None)[0]
    errors = [math.hypot(sx * b["x"] + tx - r["x"], sy * b["y"] + ty - r["y"]) for b, r in pairs]
    return (float(sx), float(sy), float(tx), float(ty)), len(pairs), errors


def main():
    labels = json.load(open(LABELS)) if os.path.exists(LABELS) else {}
    pages = load_pages()
    traced = [trace_floor(i, pages[i], labels.get(FLOORS[i][0], {})) for i in range(len(pages))]

    # Rough starting transforms measured by hand from the stair symbols; refined below.
    guesses = {1: (0.868, 0.788), 2: (0.808, 0.732), 3: (0.915, 0.786)}
    anchors = {0: (1221, 972), 1: (1443, 736), 2: (1269, 825), 3: (1296, 736)}
    towers = {0: (3135, 1715), 1: (3930, 1680), 2: (3940, 1840), 3: (3387, 1685)}  # approximate; refined by find_tower
    landmarks = {}
    for i in range(len(pages)):
        tower = find_tower(pages[i], towers[i])
        landmarks[i] = traced[i]["bars"] + ([tower] if tower else [])
        print(FLOORS[i][0], "tower landmark:", tower and (round(tower["x"]), round(tower["y"])))
    transforms = {0: (1.0, 1.0, 0.0, 0.0)}
    report = dict(floors={}, transforms={})
    for i in range(1, len(pages)):
        sx, sy = guesses[i]
        guess = (sx, sy, anchors[0][0] - sx * anchors[i][0], anchors[0][1] - sy * anchors[i][1])
        transforms[i], used, errors = fit_floor(landmarks[i], landmarks[0], guess)
        report["transforms"][FLOORS[i][0]] = dict(sx=transforms[i][0], sy=transforms[i][1], tx=transforms[i][2], ty=transforms[i][3], landmarks=used, max_error_px=max(errors, default=None), mean_error_px=(sum(errors) / len(errors) if errors else None))
    report["transforms"]["G"] = dict(sx=1, sy=1, tx=0, ty=0)

    geometry = dict(version=1, metresPerUnit=METRES_PER_UNIT, bounds=None, floors=[], regions=[], places=[], doors=[], nodes=[], edges=[])
    assignments = []
    xs, ys = [], []
    for i, floor in enumerate(traced):
        fid, fname = FLOORS[i]
        sx, sy, tx, ty = transforms[i]
        T = lambda p: [round(sx * p[0] + tx, 1), round(sy * p[1] + ty, 1)]
        geometry["floors"].append(dict(id=fid, name=fname, level=i))
        ordered = sorted(floor["regions"].items(), key=lambda kv: (round(kv[1]["labelAt"][1] / 40), kv[1]["labelAt"][0]))
        rid_of = {}
        for n, (rid, r) in enumerate(ordered, start=1):
            rid_of[rid] = f"{fid}-R{n:03d}"
            entry = dict(id=rid_of[rid], floor=fid, kind=r["kind"], polygon=[T(p) for p in r["polygon"]], labelAt=T(r["labelAt"]))
            if r["holes"]:
                entry["holes"] = [[T(p) for p in hole] for hole in r["holes"]]
            if r["name"]:
                entry["sourceLabel"] = r["name"]
            geometry["regions"].append(entry)
            if r["kind"] != "void":
                xs += [p[0] for p in entry["polygon"]]
                ys += [p[1] for p in entry["polygon"]]
            if r["kind"] == "room" and r["name"]:
                assignments.append((rid_of[rid], r["name"], r["type"] or "other"))
        place_id = {}
        for pi, pl in enumerate(floor["places"]):
            place_id[pi] = f"{fid}-P{pi + 1:02d}"
            x, y = T((pl["x"], pl["y"]))
            geometry["places"].append(dict(id=place_id[pi], floor=fid, x=x, y=y, region=rid_of[pl["region"]], sourceLabel=pl["name"]))
            assignments.append((place_id[pi], pl["name"], pl["type"]))
        door_id = {}
        for di, d in enumerate(floor["doors"]):
            door_id[di] = f"{fid}-D{di + 1:03d}"
            x, y = T((d["x"], d["y"]))
            geometry["doors"].append(dict(id=door_id[di], floor=fid, x=x, y=y, kind=d["kind"], a=rid_of[d["a"]], b=rid_of.get(d["b"], "outside")))
        node_id = {}
        for ni, nd in enumerate(floor["nodes"]):
            node_id[ni] = f"{fid}-N{ni + 1:04d}"
            x, y = T((nd["x"], nd["y"]))
            entry = dict(id=node_id[ni], floor=fid, x=x, y=y, kind=nd["kind"], region=rid_of.get(nd["region"]))
            if nd["door"] is not None:
                entry["door"] = door_id[nd["door"]]
            if nd.get("place") is not None:
                entry["place"] = place_id[nd["place"]]
            geometry["nodes"].append(entry)
        placed = {n["id"]: n for n in geometry["nodes"] if n["floor"] == fid}
        for ei, e in enumerate(floor["edges"]):
            a, b = placed[node_id[e["a"]]], placed[node_id[e["b"]]]
            entry = dict(id=f"{fid}-E{ei + 1:04d}", a=a["id"], b=b["id"], length=round(math.hypot(a["x"] - b["x"], a["y"] - b["y"]), 1), kind="walk")
            if e["door"] is not None:
                entry["door"] = door_id[e["door"]]
            if e.get("tags"):
                entry["tags"] = e["tags"]
            geometry["edges"].append(entry)
        report["floors"][fid] = dict(
            notes=floor["notes"],
            stairSymbols=[dict(region=rid_of[b["region"]], at=T((b["x"], b["y"]))) for b in floor["bars"]],
            # page-pixel positions, used when writing labels.json
            regions=[dict(id=rid_of[rid], kind=r["kind"], name=r["name"], page=[round(v) for v in r["labelAt"]], area=r["area"]) for rid, r in ordered],
        )
    # Facts the school told us that the drawing cannot show. They are keyed by the final ids,
    # so a re-trace that renumbers rooms fails here loudly instead of marking the wrong door.
    links = labels.get("links", {})
    region_by_id = {r["id"]: r for r in geometry["regions"]}
    door_by_id = {d["id"]: d for d in geometry["doors"]}
    for room, entrances in links.get("entrances", {}).items():
        for rid in [room] + entrances:
            assert rid in region_by_id and region_by_id[rid]["kind"] == "room", f"links.entrances: {rid} is not a room"
        region_by_id[room]["entrances"] = entrances
    for did in links.get("restrictedDoors", []):
        assert did in door_by_id, f"links.restrictedDoors: {did} is not a door"
        door_by_id[did]["restricted"] = True

    geometry["bounds"] = dict(minX=math.floor(min(xs)), minY=math.floor(min(ys)), maxX=math.ceil(max(xs)), maxY=math.ceil(max(ys)))

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "geometry.json"), "w") as f:
        json.dump(geometry, f, separators=(",", ":"))
    with open(os.path.join(OUT_DIR, "assignments.csv"), "w", newline="") as f:
        f.write("room_id,name,subject,teacher,type\n")
        # Names printed more than once (two "Clinic" rooms, a washroom per floor) get a short
        # suffix so every destination is unique in search. An admin can rename them later.
        total, seen = {}, {}
        for _, name, _ in assignments:
            total[name] = total.get(name, 0) + 1
        unique = []
        for rid, name, kind in assignments:
            if total[name] > 1:
                key = (name, rid.split("-")[0])
                seen[key] = seen.get(key, 0) + 1
                name = f"{name} ({key[1]}-{seen[key]})"
            unique.append((rid, name, kind))
        assignments = unique
        for rid, name, kind in assignments:
            cell = '"' + name.replace('"', '""') + '"' if "," in name or '"' in name else name
            f.write(f"{rid},{cell},,,{kind}\n")
    with open(REPORT, "w") as f:
        json.dump(report, f, indent=1)
    for fid, _ in FLOORS:
        fl = report["floors"][fid]
        kinds = {}
        for r in fl["regions"]:
            kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
        print(fid, kinds, "stair symbols:", len(fl["stairSymbols"]), "|", "; ".join(fl["notes"]))
    print("transforms:", json.dumps(report["transforms"]))


if __name__ == "__main__":
    main()
