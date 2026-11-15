-- =============================================================================
-- Rooms migration, step A (additive only). Plan: MAP_NOTES.md, "Rooms
-- migration plan". Nothing students see changes:
--
--   * rooms gets `region_id` (the geometry id, e.g. 'G-R014') and
--     `retired_at` (set later, in step B, on the 15 placeholders: they are
--     hidden, never deleted).
--   * floor 3 is added. floors.image_path becomes optional: a floor without
--     an image is drawn from geometry.json by the new map.
--   * one rooms row per named traced room and place.
--   * three helper tables for step B and for undo:
--       room_migration_traced  the traced rooms to add (generated data)
--       room_migration_map     placeholder code -> traced room
--       room_migration_backup  every report, venue and event that has a
--                              room, with its old room, floor and x/y
--
-- Today's screens (map, room pickers, old Map admin page) read only rooms with
-- region_id null and floors with an image, so the new rows stay out of sight
-- until step B ships with the new map (src/features/map/api.ts).
--
-- The work is done by room_migration_a_fill(), which can run more than once:
-- this migration calls it (on a project that already has its floors and
-- placeholder rooms, that does everything), and supabase/seed.sql calls it
-- again at its end (a fresh local database gets its floors and placeholders
-- from the seed, after the migrations).
--
-- Undo (only before step B): see docs/runbooks/map-nav-phase1-cloud.md.
-- =============================================================================

alter table public.rooms
  add column region_id text unique,
  add column retired_at timestamptz;

alter table public.floors alter column image_path drop not null;

-- -----------------------------------------------------------------------------
-- Helper tables. Admins can read them; nobody can change them from the app.
-- -----------------------------------------------------------------------------
create table public.room_migration_traced (
  region_id text primary key,
  floor text not null,
  name text not null,
  kind public.room_kind not null,
  x numeric not null,
  y numeric not null,
  created_at timestamptz not null default now()
);

create table public.room_migration_map (
  old_code text primary key,
  new_region_id text not null,
  -- Filled in by room_migration_a_fill() once both rooms exist.
  old_room_id uuid references public.rooms (id) on delete restrict,
  new_room_id uuid references public.rooms (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.room_migration_backup (
  id uuid primary key default gen_random_uuid(),
  table_name text not null check (table_name in ('reports', 'venues', 'volunteer_events')),
  row_id uuid not null,
  old_room_id uuid not null,
  old_floor_id uuid,
  old_x numeric,
  old_y numeric,
  captured_at timestamptz not null default now(),
  unique (table_name, row_id)
);

alter table public.room_migration_traced enable row level security;
alter table public.room_migration_map enable row level security;
alter table public.room_migration_backup enable row level security;

create policy "Admins read traced rooms"
on public.room_migration_traced for select to authenticated using (public.is_admin());

create policy "Admins read the room mapping"
on public.room_migration_map for select to authenticated using (public.is_admin());

create policy "Admins read the room backup"
on public.room_migration_backup for select to authenticated using (public.is_admin());

revoke insert, update, delete, truncate on
  public.room_migration_traced, public.room_migration_map, public.room_migration_backup
from authenticated, anon;

-- -----------------------------------------------------------------------------
-- The proposed mapping from MAP_NOTES.md (an admin can adjust it before B).
-- -----------------------------------------------------------------------------
insert into public.room_migration_map (old_code, new_region_id) values
  ('G.01', 'G-R074'), -- Auditorium
  ('G.02', 'G-P02'),  -- Reception (place)
  ('G.03', 'G-R031'), -- PYP3 A
  ('G.04', 'G-R030'), -- PYP3 B
  ('G.05', 'G-R023'), -- Senior Library
  ('G.06', 'G-R008'), -- Design and Technology Lab
  ('G.07', 'G-R110'), -- IT 1 GF
  ('G.08', 'G-R051'), -- Canteen (G-1)
  ('1.01', '1-R032'), -- 9A
  ('1.02', '1-R062'), -- 9B
  ('1.03', '1-R162'), -- IT FF2
  ('1.04', 'G-R201'), -- Conference Room (changes floor)
  ('2.01', 'G-R135'), -- Multipurpose Hall (changes floor)
  ('2.02', '1-R003'), -- Art (1-1) (changes floor)
  ('2.03', '2-R104'); -- Music Room (2-1)

-- -----------------------------------------------------------------------------
-- The traced rooms: generated from geometry.json and assignments.csv by
-- `npm run map:sql`. Do not edit by hand.
-- -----------------------------------------------------------------------------
-- <generated:traced-rooms>
-- 285 named rooms and places (unnamed ones are left out)
insert into public.room_migration_traced (region_id, floor, name, kind, x, y) values
  ('1-R001', '1', 'Sewing', 'classroom', 1694, 619),
  ('1-R002', '1', 'Pottery', 'classroom', 1812, 614),
  ('1-R003', '1', 'Art (1-1)', 'classroom', 1938, 626),
  ('1-R004', '1', 'IT Services', 'office', 2081, 626),
  ('1-R016', '1', 'MYP4 G', 'classroom', 1012, 735),
  ('1-R017', '1', '6D', 'classroom', 2804, 740),
  ('1-R019', '1', 'MYP Coordinator', 'office', 801, 772),
  ('1-R020', '1', 'MYP2 C', 'classroom', 1120, 781),
  ('1-R021', '1', 'Budhayana Spark Lab', 'lab', 1779, 771),
  ('1-R022', '1', '6A', 'classroom', 2692, 785),
  ('1-R023', '1', 'Male Prayer Room (1-1)', 'other', 1229, 796),
  ('1-R024', '1', 'MYP2 D', 'classroom', 1316, 810),
  ('1-R025', '1', 'CPR', 'other', 1512, 810),
  ('1-R026', '1', 'Female Prayer Room (1-1)', 'other', 2593, 794),
  ('1-R028', '1', 'Supervisor Grade 6 & MYP 1', 'office', 3050, 816),
  ('1-R032', '1', '9A', 'classroom', 2216, 834),
  ('1-R033', '1', '9C', 'classroom', 2337, 834),
  ('1-R034', '1', '9E', 'classroom', 2464, 833),
  ('1-R039', '1', 'MYP2 A', 'classroom', 933, 871),
  ('1-R041', '1', '6C', 'classroom', 2899, 868),
  ('1-R046', '1', 'MYP2 B', 'classroom', 1046, 918),
  ('1-R048', '1', 'Head of Middle School & Teaching Learning Coach', 'office', 1812, 938),
  ('1-R049', '1', 'Female Washroom (1-1)', 'other', 1988, 936),
  ('1-R050', '1', 'Supervisor Grade 9 ICSE', 'office', 2052, 938),
  ('1-R052', '1', '6B', 'classroom', 2787, 912),
  ('1-R053', '1', 'MYP2 E', 'classroom', 1335, 957),
  ('1-R054', '1', 'MYP2 F', 'classroom', 1461, 956),
  ('1-R055', '1', 'MYP1 G', 'classroom', 2509, 957),
  ('1-R059', '1', '9F', 'classroom', 1600, 974),
  ('1-R060', '1', 'Male Washroom (1-1)', 'other', 2020, 996),
  ('1-R061', '1', 'Exam Photocopy', 'other', 2084, 997),
  ('1-R062', '1', '9B', 'classroom', 2283, 979),
  ('1-R063', '1', '9D', 'classroom', 2409, 979),
  ('1-R067', '1', 'School Counselor', 'office', 1820, 1004),
  ('1-R068', '1', 'Examination Center', 'other', 1906, 1005),
  ('1-R069', '1', 'Counsellors Room', 'office', 1741, 1114),
  ('1-R070', '1', 'Arabic & Islamic Education Supervisors', 'office', 2080, 1114),
  ('1-R072', '1', 'Female Prayer Room (1-2)', 'other', 2229, 1183),
  ('1-R080', '1', 'MYP3 E', 'classroom', 1272, 1426),
  ('1-R081', '1', 'MYP3 F', 'classroom', 1387, 1419),
  ('1-R082', '1', 'SOR FF-4', 'other', 1529, 1419),
  ('1-R085', '1', 'Physics Store (1-1)', 'other', 2281, 1411),
  ('1-R086', '1', 'Physics Lab (1-1)', 'lab', 2449, 1427),
  ('1-R091', '1', 'Grade 5 AC', 'other', 2255, 1467),
  ('1-R094', '1', 'MYP3 D', 'classroom', 988, 1476),
  ('1-R095', '1', 'MYP3 A', 'classroom', 877, 1527),
  ('1-R097', '1', 'Physics Lab (1-2)', 'lab', 2912, 1515),
  ('1-R098', '1', '7E', 'classroom', 1243, 1560),
  ('1-R099', '1', 'Male Washroom (1-2)', 'other', 2212, 1562),
  ('1-R101', '1', 'Physics Store (1-2)', 'other', 3035, 1543),
  ('1-R102', '1', 'Mind Spark Lab', 'lab', 1519, 1584),
  ('1-R103', '1', 'Female Washroom (1-2)', 'other', 1606, 1590),
  ('1-R104', '1', 'SOR FF-3', 'other', 2298, 1587),
  ('1-R105', '1', 'PYP5 I', 'classroom', 2413, 1593),
  ('1-R106', '1', 'PYP5 J', 'classroom', 2548, 1588),
  ('1-R109', '1', 'MYP3 C', 'classroom', 1070, 1621),
  ('1-R110', '1', '7F', 'classroom', 1426, 1611),
  ('1-R116', '1', 'Biology Lab', 'lab', 2752, 1623),
  ('1-R117', '1', 'MYP3 B', 'classroom', 963, 1671),
  ('1-R119', '1', 'MYP 2&3 Supervisor', 'office', 867, 1705),
  ('1-R120', '1', 'Biology Store', 'other', 3014, 1719),
  ('1-R128', '1', 'Resource Room', 'other', 847, 2127),
  ('1-R132', '1', 'General Science Lab', 'lab', 2822, 2177),
  ('1-R134', '1', 'PYP4 I', 'classroom', 971, 2189),
  ('1-R137', '1', 'PYP4 H', 'classroom', 1098, 2227),
  ('1-R139', '1', 'SOR FF-2', 'other', 1649, 2242),
  ('1-R140', '1', 'PYP5 H', 'classroom', 1768, 2239),
  ('1-R141', '1', 'PYP5 K', 'classroom', 2052, 2239),
  ('1-R142', '1', 'PYP5 G', 'classroom', 2165, 2241),
  ('1-R143', '1', 'PYP5 F', 'classroom', 2271, 2236),
  ('1-R144', '1', 'Staff Room (1-1)', 'office', 2440, 2242),
  ('1-R146', '1', 'PYP4 J', 'classroom', 863, 2267),
  ('1-R147', '1', 'PYP4 E', 'classroom', 1244, 2266),
  ('1-R148', '1', 'PYP4 D', 'classroom', 1364, 2263),
  ('1-R149', '1', 'PYP4 A', 'classroom', 1490, 2260),
  ('1-R151', '1', 'PYP5 A', 'classroom', 2941, 2303),
  ('1-R153', '1', 'PYP4 G', 'classroom', 970, 2315),
  ('1-R155', '1', 'PYP5 B', 'classroom', 2834, 2355),
  ('1-R157', '1', 'STEAM Studio', 'lab', 1641, 2406),
  ('1-R158', '1', 'PYP 4&5 Supervisors', 'office', 2060, 2393),
  ('1-R159', '1', 'PYP5 E', 'classroom', 2171, 2406),
  ('1-R160', '1', 'PYP5 D', 'classroom', 2295, 2402),
  ('1-R161', '1', 'PYP5 C', 'classroom', 2428, 2406),
  ('1-R162', '1', 'IT FF2', 'lab', 2551, 2401),
  ('1-R164', '1', 'PYP4 F', 'classroom', 1246, 2427),
  ('1-R165', '1', 'PYP4 C', 'classroom', 1365, 2431),
  ('1-R166', '1', 'PYP4 B', 'classroom', 1489, 2424),
  ('2-P01', '2', 'Staff Room (2-1)', 'office', 1924, 995),
  ('2-P02', '2', 'Bio Lab', 'lab', 2888, 1492),
  ('2-P03', '2', 'Chem Lab', 'lab', 2796, 1651),
  ('2-P04', '2', 'Bio Store', 'other', 3055, 1564),
  ('2-P05', '2', 'Chem Store', 'other', 3007, 1731),
  ('2-R005', '2', 'Agile Learning Center (2-1)', 'hall', 1742, 664),
  ('2-R006', '2', 'Agile Learning Center (2-2)', 'hall', 2028, 664),
  ('2-R012', '2', 'Geography Lab', 'lab', 2928, 715),
  ('2-R015', '2', 'MYP4 A', 'classroom', 1009, 735),
  ('2-R017', '2', 'MYP4 B', 'classroom', 1118, 781),
  ('2-R019', '2', 'ISC Lounge', 'other', 1975, 790),
  ('2-R021', '2', '10 C', 'classroom', 2793, 773),
  ('2-R024', '2', 'MYP4 E', 'classroom', 1314, 810),
  ('2-R025', '2', 'MYP5 A', 'classroom', 1440, 811),
  ('2-R026', '2', 'MYP5 B', 'classroom', 1565, 810),
  ('2-R027', '2', 'MYP5 D', 'classroom', 1685, 810),
  ('2-R028', '2', 'MYP5 E', 'classroom', 2059, 810),
  ('2-R029', '2', '10 B', 'classroom', 2681, 816),
  ('2-R031', '2', 'MYP 4 & 5 Supervisor', 'office', 1191, 836),
  ('2-R032', '2', 'DP 9', 'classroom', 2219, 832),
  ('2-R033', '2', 'DP 10', 'classroom', 2373, 833),
  ('2-R034', '2', 'DP 12', 'classroom', 2487, 835),
  ('2-R035', '2', 'Grade 9 & 10 Supervisor', 'office', 2588, 833),
  ('2-R037', '2', '10 D', 'classroom', 2905, 841),
  ('2-R040', '2', '11 E', 'classroom', 931, 872),
  ('2-R045', '2', '10 A', 'classroom', 2797, 887),
  ('2-R046', '2', 'MYP4 C', 'classroom', 1044, 918),
  ('2-R050', '2', 'DP 11', 'classroom', 2409, 932),
  ('2-R051', '2', 'DP 13', 'classroom', 2530, 934),
  ('2-R053', '2', 'MYP4 D', 'classroom', 1333, 957),
  ('2-R054', '2', 'MYP4 F', 'classroom', 1459, 957),
  ('2-R055', '2', 'MYP5 C', 'classroom', 1563, 955),
  ('2-R056', '2', 'Senior School AS/AC', 'office', 1736, 939),
  ('2-R057', '2', 'ICT Engineer', 'office', 2084, 938),
  ('2-R058', '2', 'Cookery Lab', 'lab', 2258, 958),
  ('2-R069', '2', 'Dance Studio', 'hall', 1825, 1141),
  ('2-R071', '2', 'AV Hub', 'other', 2229, 1184),
  ('2-R080', '2', '8 D', 'classroom', 1260, 1404),
  ('2-R081', '2', '8 E', 'classroom', 1373, 1406),
  ('2-R082', '2', 'SOR SF-6', 'other', 1521, 1426),
  ('2-R083', '2', 'Store (2-1)', 'other', 2282, 1411),
  ('2-R084', '2', 'Chem Lab 2', 'lab', 2449, 1426),
  ('2-R085', '2', '7 A', 'classroom', 1002, 1440),
  ('2-R093', '2', '7 D', 'classroom', 889, 1492),
  ('2-R095', '2', 'Grade 8 Supervisor', 'office', 1166, 1569),
  ('2-R096', '2', '8 C', 'classroom', 1249, 1563),
  ('2-R097', '2', 'Female Washroom (2-1)', 'other', 1606, 1563),
  ('2-R098', '2', 'Female Washroom (2-2)', 'other', 2213, 1562),
  ('2-R099', '2', '7 B', 'classroom', 1086, 1585),
  ('2-R103', '2', 'IER 2', 'other', 2298, 1586),
  ('2-R104', '2', 'Music Room (2-1)', 'classroom', 2419, 1587),
  ('2-R105', '2', 'SOR SF-5', 'other', 2653, 1572),
  ('2-R106', '2', '8 B', 'classroom', 1371, 1606),
  ('2-R107', '2', '8 A', 'classroom', 1537, 1610),
  ('2-R108', '2', 'Male Washroom (2-1)', 'other', 1606, 1613),
  ('2-R109', '2', 'Male Washroom (2-2)', 'other', 2213, 1611),
  ('2-R114', '2', '7 C', 'classroom', 952, 1704),
  ('3-P01', '3', 'DP Lounge', 'other', 2445, 826),
  ('3-R006', '3', 'DP 8', 'classroom', 2819, 713),
  ('3-R010', '3', '11 C', 'classroom', 1013, 739),
  ('3-R013', '3', '11 B', 'classroom', 1121, 786),
  ('3-R016', '3', 'DP 1', 'classroom', 2267, 789),
  ('3-R019', '3', '11 & 12 Supervisors', 'office', 1221, 827),
  ('3-R020', '3', '12 A', 'classroom', 1322, 842),
  ('3-R021', '3', '12 D', 'classroom', 1446, 842),
  ('3-R022', '3', '12 E', 'classroom', 1579, 842),
  ('3-R024', '3', 'IBDP Coordinator / Asst. DP Coordinator', 'office', 2603, 828),
  ('3-R025', '3', 'DP 7', 'classroom', 2683, 821),
  ('3-R026', '3', 'DP 6', 'classroom', 2907, 845),
  ('3-R027', '3', '11 D', 'classroom', 931, 877),
  ('3-R029', '3', 'DP 5', 'classroom', 2797, 892),
  ('3-R030', '3', '11 A', 'classroom', 1044, 924),
  ('3-R034', '3', 'DP 2', 'classroom', 2217, 938),
  ('3-R035', '3', 'DP 3', 'classroom', 2382, 940),
  ('3-R036', '3', 'DP 4', 'classroom', 2512, 940),
  ('3-R039', '3', 'Career Counsellor', 'office', 2154, 955),
  ('3-R043', '3', '12 B', 'classroom', 1323, 989),
  ('3-R044', '3', '12 C', 'classroom', 1446, 989),
  ('3-R045', '3', '12 F', 'classroom', 1572, 989),
  ('3-R046', '3', 'IB Secretary', 'office', 1734, 978),
  ('3-R047', '3', 'Staff Room (3-1)', 'office', 1919, 992),
  ('3-R050', '3', 'SOR TF-7', 'other', 1721, 1023),
  ('G-P01', 'G', 'Parents Lounge', 'other', 1710, 2240),
  ('G-P02', 'G', 'Reception', 'office', 2035, 2393),
  ('G-P03', 'G', 'PYP 2 Supervisor', 'office', 2613, 1786),
  ('G-R004', 'G', 'Clinic (G-1)', 'other', 1663, 599),
  ('G-R008', 'G', 'Design and Technology Lab', 'lab', 2042, 611),
  ('G-R016', 'G', 'PYP3 H', 'classroom', 1011, 713),
  ('G-R017', 'G', 'MYP1 D', 'classroom', 2801, 718),
  ('G-R018', 'G', 'Art (G-1)', 'classroom', 2921, 710),
  ('G-R019', 'G', 'Inclusion Unit', 'other', 782, 774),
  ('G-R020', 'G', 'PYP3 E', 'classroom', 1120, 765),
  ('G-R022', 'G', 'PYP 3 Supervisor', 'office', 1532, 763),
  ('G-R023', 'G', 'Senior Library', 'library', 1901, 779),
  ('G-R024', 'G', 'Supervisor Teaching & Learning', 'office', 2293, 759),
  ('G-R026', 'G', 'MYP1 C', 'classroom', 2691, 770),
  ('G-R027', 'G', 'Art (G-2)', 'classroom', 3021, 751),
  ('G-R030', 'G', 'PYP3 B', 'classroom', 1315, 797),
  ('G-R031', 'G', 'PYP3 A', 'classroom', 1441, 798),
  ('G-R032', 'G', 'Male Washroom (G-1)', 'other', 1616, 781),
  ('G-R033', 'G', 'Dean of Studies', 'office', 1774, 781),
  ('G-R034', 'G', 'Vice-Principal / Head Primary', 'office', 2029, 803),
  ('G-R035', 'G', 'Female Washroom (G-1)', 'other', 2230, 782),
  ('G-R036', 'G', 'PYP3 I', 'classroom', 2363, 798),
  ('G-R037', 'G', 'MYP1 A', 'classroom', 2487, 797),
  ('G-R040', 'G', 'Director Student Welfare', 'office', 1613, 836),
  ('G-R041', 'G', 'Digital Learning Center', 'other', 1701, 837),
  ('G-R042', 'G', 'Head of Senior School / Dean of Assessment and Data', 'office', 2114, 843),
  ('G-R043', 'G', 'Secretary', 'office', 2231, 837),
  ('G-R046', 'G', 'PYP3 G', 'classroom', 932, 866),
  ('G-R048', 'G', 'MYP1 F', 'classroom', 2898, 862),
  ('G-R049', 'G', 'PYP3 F', 'classroom', 1045, 918),
  ('G-R051', 'G', 'Canteen (G-1)', 'cafeteria', 1565, 937),
  ('G-R055', 'G', 'Music', 'classroom', 2262, 935),
  ('G-R057', 'G', 'MYP1 E', 'classroom', 2788, 911),
  ('G-R058', 'G', 'PYP3 C', 'classroom', 1336, 961),
  ('G-R059', 'G', 'PYP3 D', 'classroom', 1461, 961),
  ('G-R060', 'G', 'Inclusion', 'other', 1862, 962),
  ('G-R061', 'G', 'SOR GF-1', 'other', 2054, 950),
  ('G-R062', 'G', 'PYP3 J', 'classroom', 2383, 961),
  ('G-R063', 'G', 'MYP1 B', 'classroom', 2508, 962),
  ('G-R073', 'G', 'Male Prayer Room (G-1)', 'other', 2292, 1251),
  ('G-R074', 'G', 'Auditorium', 'hall', 1941, 1313),
  ('G-R082', 'G', 'PYP2 E', 'classroom', 1238, 1431),
  ('G-R083', 'G', 'PYP2 D', 'classroom', 1429, 1435),
  ('G-R084', 'G', 'PYP2 A', 'classroom', 1484, 1434),
  ('G-R089', 'G', 'PYP1 B', 'classroom', 2387, 1445),
  ('G-R090', 'G', 'PYP1 C', 'classroom', 2515, 1444),
  ('G-R092', 'G', 'IER', 'other', 886, 1497),
  ('G-R093', 'G', 'PYP2 F', 'classroom', 948, 1491),
  ('G-R094', 'G', 'Female Washroom (G-2)', 'other', 1731, 1462),
  ('G-R095', 'G', 'Male Washroom (G-2)', 'other', 2113, 1462),
  ('G-R096', 'G', 'Music Violin', 'classroom', 2277, 1463),
  ('G-R097', 'G', 'PYP1 E', 'classroom', 2798, 1494),
  ('G-R099', 'G', 'Facility Manager', 'office', 753, 1552),
  ('G-R102', 'G', 'Asst. MSO', 'office', 2109, 1550),
  ('G-R104', 'G', 'PYP1 G', 'classroom', 2913, 1542),
  ('G-R105', 'G', 'PYP Coordinator', 'office', 3063, 1550),
  ('G-R106', 'G', 'KG Music', 'classroom', 1261, 1588),
  ('G-R107', 'G', 'PYP2 C', 'classroom', 1430, 1612),
  ('G-R108', 'G', 'PYP2 B', 'classroom', 1485, 1601),
  ('G-R109', 'G', 'Music Room (G-1)', 'classroom', 1614, 1588),
  ('G-R110', 'G', 'IT 1 GF', 'lab', 2262, 1597),
  ('G-R111', 'G', 'PYP1 A', 'classroom', 2390, 1612),
  ('G-R112', 'G', 'PYP1 D', 'classroom', 2514, 1611),
  ('G-R113', 'G', 'PYP2 G', 'classroom', 1038, 1639),
  ('G-R114', 'G', 'PYP1 F', 'classroom', 2711, 1640),
  ('G-R115', 'G', 'PYP2 H', 'classroom', 926, 1687),
  ('G-R116', 'G', 'PYP 1 Supervisor', 'office', 1713, 1684),
  ('G-R118', 'G', 'PYP1 H', 'classroom', 2822, 1692),
  ('G-R122', 'G', 'Discovery Centre', 'other', 2474, 1725),
  ('G-R126', 'G', 'Store (G-1)', 'other', 3269, 1750),
  ('G-R127', 'G', 'Male Washroom (G-3)', 'other', 3304, 1746),
  ('G-R128', 'G', 'HR', 'office', 962, 1803),
  ('G-R132', 'G', 'Clinic (G-2)', 'other', 2908, 1793),
  ('G-R134', 'G', 'Hindustani Music', 'classroom', 978, 1863),
  ('G-R135', 'G', 'Multipurpose Hall', 'hall', 3357, 1872),
  ('G-R138', 'G', 'PLC', 'other', 1247, 1959),
  ('G-R139', 'G', 'STS', 'office', 971, 1998),
  ('G-R140', 'G', 'Female Washroom (G-3)', 'other', 3311, 1999),
  ('G-R143', 'G', 'Store (G-2)', 'other', 3273, 2047),
  ('G-R145', 'G', 'KG 1 & 2 Supervisor', 'office', 941, 2071),
  ('G-R147', 'G', 'Learning Support Unit', 'other', 2938, 2086),
  ('G-R152', 'G', 'Canteen (G-2)', 'cafeteria', 3364, 2139),
  ('G-R153', 'G', 'PE Room', 'other', 3414, 2132),
  ('G-R155', 'G', 'KG2 I', 'classroom', 951, 2156),
  ('G-R156', 'G', 'Pre KG C', 'classroom', 2860, 2161),
  ('G-R157', 'G', 'KG2 F', 'classroom', 1070, 2215),
  ('G-R158', 'G', 'Principal', 'office', 2071, 2206),
  ('G-R159', 'G', 'Pre KG D', 'classroom', 2741, 2218),
  ('G-R161', 'G', 'KG Swimming Pool', 'hall', 3339, 2210),
  ('G-R162', 'G', 'KG2 E', 'classroom', 1258, 2245),
  ('G-R163', 'G', 'KG2 C', 'classroom', 1399, 2245),
  ('G-R165', 'G', 'Director', 'office', 2123, 2221),
  ('G-R166', 'G', 'GRE', 'other', 744, 2281),
  ('G-R168', 'G', 'KG1 G', 'classroom', 1480, 2266),
  ('G-R170', 'G', 'Principal Secretary', 'office', 2083, 2270),
  ('G-R171', 'G', 'KG1 B', 'classroom', 2264, 2268),
  ('G-R172', 'G', 'KG1 D', 'classroom', 2384, 2267),
  ('G-R173', 'G', 'KG1 F', 'classroom', 2583, 2263),
  ('G-R175', 'G', 'KG2 H', 'classroom', 862, 2303),
  ('G-R176', 'G', 'Pre KG B', 'classroom', 2947, 2310),
  ('G-R177', 'G', 'Swimming Pool', 'hall', 3350, 2326),
  ('G-R178', 'G', 'KG2 G', 'classroom', 985, 2361),
  ('G-R179', 'G', 'Female Washroom (G-4)', 'other', 1675, 2352),
  ('G-R181', 'G', 'Accounts', 'office', 2106, 2361),
  ('G-R182', 'G', 'GSM', 'office', 2154, 2349),
  ('G-R184', 'G', 'Pre KG A', 'classroom', 2825, 2367),
  ('G-R187', 'G', 'KG2 D', 'classroom', 1256, 2409),
  ('G-R188', 'G', 'KG2 B', 'classroom', 1374, 2414),
  ('G-R189', 'G', 'KG2 A', 'classroom', 1523, 2409),
  ('G-R193', 'G', 'Male Washroom (G-4)', 'other', 1690, 2430),
  ('G-R194', 'G', 'MSO', 'office', 2163, 2439),
  ('G-R195', 'G', 'KG1 A', 'classroom', 2333, 2433),
  ('G-R196', 'G', 'KG1 C', 'classroom', 2453, 2434),
  ('G-R197', 'G', 'KG1 E', 'classroom', 2579, 2433),
  ('G-R201', 'G', 'Conference Room', 'other', 1775, 2515),
  ('G-R203', 'G', 'Registrar', 'office', 2039, 2501);
-- </generated:traced-rooms>

-- -----------------------------------------------------------------------------
-- room_migration_a_fill(): adds what is missing, changes nothing that exists.
-- Safe to run again. Only the database owner runs it (migration and seed).
-- -----------------------------------------------------------------------------
create function public.room_migration_a_fill()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Floor 3. Width and height = maxX and maxY of geometry.bounds (map units).
  -- No image: the new map draws it from geometry.json.
  insert into public.floors (name, sort_order, image_path, width, height)
  select '3', 3, null, 3448, 2551
  where not exists (select 1 from public.floors where name = '3');

  -- One rooms row per traced room, on floors that exist.
  insert into public.rooms (floor_id, code, name, kind, x, y, region_id)
  select f.id, t.region_id, t.name, t.kind, t.x, t.y, t.region_id
  from public.room_migration_traced t
  join public.floors f on f.name = t.floor
  where not exists (select 1 from public.rooms r where r.region_id = t.region_id);

  -- Resolve the mapping to room ids where both ends exist.
  update public.room_migration_map m
  set old_room_id = (select id from public.rooms where code = m.old_code and region_id is null),
      new_room_id = (select id from public.rooms where region_id = m.new_region_id)
  where m.old_room_id is null or m.new_room_id is null;

  -- Back up every report, venue and event that has a room. A row already
  -- backed up is refreshed, so running this again (or in step B) is current.
  insert into public.room_migration_backup (table_name, row_id, old_room_id, old_floor_id, old_x, old_y)
  select 'reports', id, room_id, floor_id, x, y from public.reports where room_id is not null
  union all
  select 'venues', id, room_id, null, null, null from public.venues where room_id is not null
  union all
  select 'volunteer_events', id, room_id, null, null, null from public.volunteer_events where room_id is not null
  on conflict (table_name, row_id) do update set
    old_room_id = excluded.old_room_id,
    old_floor_id = excluded.old_floor_id,
    old_x = excluded.old_x,
    old_y = excluded.old_y,
    captured_at = now();
end;
$$;

revoke execute on function public.room_migration_a_fill() from public, anon, authenticated;

select public.room_migration_a_fill();
