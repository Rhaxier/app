-- =============================================================================
-- 03 School map: floors and rooms.
--
-- Each floor is an image (public/floorplans/*.svg). Rooms are pins placed on
-- that image in pixel coordinates: x from the left edge, y from the top edge.
-- Everyone can read the map; only admins can change it (and every change is
-- audited). Real floor plans replace the placeholders later (Q6).
-- =============================================================================

create type public.room_kind as enum (
  'classroom', 'lab', 'office', 'hall', 'library', 'cafeteria', 'other'
);

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- 'G', '1', '2'
  sort_order int not null default 0,
  image_path text not null, -- e.g. '/floorplans/floor-g.svg'
  width int not null check (width > 0),
  height int not null check (height > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors (id) on delete restrict,
  code text not null unique, -- e.g. 'G.14'
  name text not null,
  kind public.room_kind not null default 'classroom',
  x numeric not null check (x >= 0),
  y numeric not null check (y >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_floor_idx on public.rooms (floor_id);

create trigger floors_updated_at
before update on public.floors
for each row execute function public.set_updated_at();

create trigger rooms_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

create trigger floors_audit
after insert or update or delete on public.floors
for each row execute function public.audit_change();

create trigger rooms_audit
after insert or update or delete on public.rooms
for each row execute function public.audit_change();

alter table public.floors enable row level security;
alter table public.rooms enable row level security;

create policy "Everyone reads floors"
on public.floors for select to authenticated
using (true);

create policy "Admins manage floors"
on public.floors for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Everyone reads rooms"
on public.rooms for select to authenticated
using (true);

create policy "Admins manage rooms"
on public.rooms for all to authenticated
using (public.is_admin())
with check (public.is_admin());
