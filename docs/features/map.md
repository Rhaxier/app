# School map

An interactive campus map: find a room, see what's in use, and (with fix-it) where the
problems are. Same shape as announcements; read [`announcements.md`](announcements.md) first.

## What it does

- One floor plan image per floor (G, 1, 2), switched with the G / 1 / 2 control.
- **Room pins** (teal) for every room; tap one for its details, a **Book** shortcut if a
  venue is in that room, and **Report issue**.
- **In use now** pins (dark with a ring) come from approved bookings happening right now.
  They refresh every minute and whenever a booking changes (Realtime).
- **Find a room** searches room codes and names across all floors.
- Links like `/map?room=G.06` open the right floor with that room selected (used by
  volunteering events and fix-it reports).
- Admins edit floors and rooms on **Admin > Map**: click the plan to place a pin.
- The plans in `public/floorplans/` are placeholders (Q6).

## How the map works

Leaflet normally shows the world; with `CRS.Simple` it shows a flat picture measured in
pixels, which is what an indoor plan needs. The plan is an `ImageOverlay` covering
`(0,0)` to `(height,width)`. Rooms store `x`, `y` in plan pixels with `y` from the **top**,
while Leaflet counts from the **bottom**: `toLatLng()` and `fromLatLng()` in `logic.ts`
convert, so nothing else has to think about it.

## Tables

| Table    | What it holds                                      |
| -------- | -------------------------------------------------- |
| `floors` | Name, image path, image width and height           |
| `rooms`  | Floor, code, name, kind, and pin position `x`, `y` |

Everyone reads them; only admins change them, and every change is in the audit log.
Migration: `supabase/migrations/20261019120300_map.sql`.

## Files to read

1. `src/features/map/logic.ts` (coordinates, search, in use).
2. `components/MapView.tsx` (the Leaflet map), `components/Pins.tsx`.
3. `pages/MapPage.tsx` (reference screen 2), `components/RoomCard.tsx`, `RoomSearch.tsx`.
4. `map.test.tsx`.

## Replacing the placeholder plans

See Q6 in `docs/OPEN_QUESTIONS.md`: export each floor as SVG or PNG, put it in
`public/floorplans/`, set the floor's image path, width and height on Admin > Map, then
click the plan to place each room.
