-- =============================================================================
-- Indoor navigation: the parts of the map that admins edit without a deploy.
--
-- The walls, rooms, corridors and doors stay in a bundled file
-- (src/features/map/nav/data/geometry.json); nobody edits them in the app.
-- What changes during the year lives here instead:
--
--   map_connectors   stairs and lifts (an admin places them in the editor)
--   map_presets      named sets of room names, e.g. "Term 1", "Term 2"
--   map_assignments  one preset's names: room id -> name, class, teacher, type
--   map_overrides    flags laid over the geometry: a closed door, edge tags
--   app_settings.map_active_preset_id   the one preset students see
--
-- Plus map_geometry_ids: the list of ids that exist in geometry.json, so the
-- functions below can refuse an id that isn't on the map. Its rows are
-- generated (next migration, `npm run map:sql`).
--
-- Rules:
--   * Everyone signed in reads every table (the student map needs them).
--   * Nobody writes to the tables directly. Every change goes through one of
--     the map_* functions below, which check who is asking, check the data
--     (the same checks the admin screens make, so a bad client can't write
--     bad data), and write audit_log.
--   * Admins can do everything. Staff who handle fix-it reports (anyone with a
--     responsibility that an active report category is routed to, e.g.
--     facilities or it) can only mark a lift, stairs or door out of order and
--     back in service. A student report never changes a flag by itself.
--   * No stairs or lifts are ever created here or in the seed: an admin
--     places the real ones.
-- =============================================================================

create type public.map_connector_type as enum ('stairs', 'lift');
create type public.map_override_kind as enum ('door', 'edge');
-- Same list as RoomType in src/features/map/nav/types.ts.
create type public.map_room_type as enum (
  'classroom', 'lab', 'office', 'hall', 'library', 'cafeteria', 'toilet', 'prayer', 'store', 'other'
);

-- -----------------------------------------------------------------------------
-- map_geometry_ids: what exists in geometry.json. Generated, never edited.
-- `destination` marks what can be given a name (rooms, wall-less places and
-- doors that lead outside), matching destinationIds() in nav/assignments.ts.
-- -----------------------------------------------------------------------------
create table public.map_geometry_ids (
  id text primary key,
  kind text not null check (kind in ('room', 'place', 'door', 'edge')),
  floor text not null,
  destination boolean not null default false,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- map_connectors: one row per staircase or lift, with a position on each floor
-- it serves: positions = {"G": {"x": 1221, "y": 978}, "1": {...}}.
-- Same shape as the Connector type, so the client passes rows straight to
-- the router. Names are unique (checked in map_save_connectors, which is the
-- only writer and locks the table while it saves).
-- -----------------------------------------------------------------------------
create table public.map_connectors (
  id uuid primary key default gen_random_uuid(),
  type public.map_connector_type not null,
  name text not null check (char_length(trim(name)) between 1 and 60),
  floors text[] not null check (cardinality(floors) >= 1),
  positions jsonb not null default '{}'::jsonb check (jsonb_typeof(positions) = 'object'),
  -- Step-free routes only use accessible connectors (lifts, normally).
  accessible boolean not null,
  -- False while out of order: routes avoid it.
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- map_presets and map_assignments: a preset is a saved set of room names.
-- Switching the active preset is one row change in app_settings.
-- -----------------------------------------------------------------------------
create table public.map_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Term 1" and "term 1" would look the same in a list.
create unique index map_presets_name_key on public.map_presets (lower(name));

create table public.map_assignments (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.map_presets (id) on delete cascade,
  -- A geometry id such as 'G-R014' (room), 'G-P02' (place) or 'G-D001'
  -- (entrance). No foreign key to map_geometry_ids, on purpose: the geometry
  -- can be re-traced, and the functions below check ids when saving.
  region_id text not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  subject text not null default '',
  -- Free text, not linked to staff profiles (decided by the school).
  teacher text not null default '',
  type public.map_room_type not null default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (preset_id, region_id)
);

-- Two rooms in one preset can't share a name, ignoring case: students search by it.
create unique index map_assignments_name_key on public.map_assignments (preset_id, lower(name));

-- -----------------------------------------------------------------------------
-- map_overrides: flags laid over the geometry without changing it.
--   kind 'door': available = false while a door is locked or out of order.
--   kind 'edge': tags such as 'steps' or 'ramp' added to one corridor stretch.
-- Becomes MapOverrides in the client.
-- -----------------------------------------------------------------------------
create table public.map_overrides (
  id uuid primary key default gen_random_uuid(),
  kind public.map_override_kind not null,
  target_id text not null,
  available boolean not null default true,
  tags text[] not null default '{}'
    check (tags <@ array['steps', 'ramp', 'narrow', 'outdoor']::text[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, target_id)
);

-- The one switch that decides which room names students see. Null means
-- "no preset yet": the app then uses the bundled assignments.csv.
-- `on delete restrict` stops the active preset being deleted.
alter table public.app_settings
  add column map_active_preset_id uuid references public.map_presets (id) on delete restrict;

create trigger map_connectors_updated_at
before update on public.map_connectors
for each row execute function public.set_updated_at();

create trigger map_presets_updated_at
before update on public.map_presets
for each row execute function public.set_updated_at();

create trigger map_assignments_updated_at
before update on public.map_assignments
for each row execute function public.set_updated_at();

create trigger map_overrides_updated_at
before update on public.map_overrides
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: everyone signed in reads; nobody writes directly (no write policies,
-- and the write grants are taken away too, so a mistake in a later policy
-- can't open them up). The functions below are security definer.
-- -----------------------------------------------------------------------------
alter table public.map_geometry_ids enable row level security;
alter table public.map_connectors enable row level security;
alter table public.map_presets enable row level security;
alter table public.map_assignments enable row level security;
alter table public.map_overrides enable row level security;

create policy "Signed-in users read map ids"
on public.map_geometry_ids for select to authenticated using (true);

create policy "Signed-in users read stairs and lifts"
on public.map_connectors for select to authenticated using (true);

create policy "Signed-in users read map presets"
on public.map_presets for select to authenticated using (true);

create policy "Signed-in users read room names"
on public.map_assignments for select to authenticated using (true);

create policy "Signed-in users read map flags"
on public.map_overrides for select to authenticated using (true);

revoke insert, update, delete, truncate on
  public.map_geometry_ids, public.map_connectors, public.map_presets,
  public.map_assignments, public.map_overrides
from authenticated, anon;

-- -----------------------------------------------------------------------------
-- Who may mark a lift, stairs or door out of order: admins, and staff holding
-- a responsibility that an active report category is routed to. Also used by
-- the app to decide whether to show the button (a hint only; the function
-- below checks again).
-- -----------------------------------------------------------------------------
create function public.map_can_mark_out_of_order()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or (
      public.is_staff()
      and exists (
        select 1
        from public.responsibilities r
        join public.report_categories c on c.responsibility = r.kind and c.active
        where r.user_id = auth.uid()
      )
    );
$$;

-- Raises the "admins only" error used by every admin map function.
create function public.map_require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change the map.' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- map_set_available(kind, id, available): out of order / back in service.
--   kind 'connector': id is a map_connectors id.
--   kind 'door':      id is a door id from the geometry, e.g. 'G-D089'.
-- Saves at once (no draft): it must work fast from a phone.
-- -----------------------------------------------------------------------------
create function public.map_set_available(p_kind text, p_target_id text, p_available boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connector public.map_connectors;
  v_connector_id uuid;
begin
  if not public.map_can_mark_out_of_order() then
    raise exception 'Only admins and the staff who handle fix-it reports can mark this out of order.'
      using errcode = '42501';
  end if;
  if p_available is null then
    raise exception 'Say whether it is working or out of order.';
  end if;

  if p_kind = 'connector' then
    -- A malformed id is "not found", not a crash.
    begin
      v_connector_id := p_target_id::uuid;
    exception when invalid_text_representation then
      v_connector_id := null;
    end;
    update public.map_connectors
    set available = p_available
    where id = v_connector_id
    returning * into v_connector;
    if not found then
      raise exception 'That lift or staircase isn''t on the map any more.';
    end if;
    insert into public.audit_log (actor_id, action, table_name, row_id, details)
    values (
      auth.uid(),
      case when p_available then 'map_back_in_service' else 'map_out_of_order' end,
      'map_connectors', v_connector.id::text,
      jsonb_build_object('kind', 'connector', 'name', v_connector.name, 'available', p_available)
    );

  elsif p_kind = 'door' then
    if not exists (select 1 from public.map_geometry_ids where id = p_target_id and kind = 'door') then
      raise exception '"%" is not a door on the map.', p_target_id;
    end if;
    insert into public.map_overrides (kind, target_id, available)
    values ('door', p_target_id, p_available)
    on conflict (kind, target_id) do update set available = excluded.available;
    insert into public.audit_log (actor_id, action, table_name, row_id, details)
    values (
      auth.uid(),
      case when p_available then 'map_back_in_service' else 'map_out_of_order' end,
      'map_overrides', p_target_id,
      jsonb_build_object('kind', 'door', 'available', p_available)
    );

  else
    raise exception 'Only stairs, lifts and doors can be marked out of order.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- map_set_edge_tags(edge, tags): admin only. Adds tags such as 'steps' to one
-- stretch of corridor (step-free routes avoid 'steps' and 'narrow'). An empty
-- list clears them. The geometry's own tags are not changed.
-- -----------------------------------------------------------------------------
create function public.map_set_edge_tags(p_edge_id text, p_tags text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tags text[] := coalesce(array(select distinct t from unnest(p_tags) as t order by t), '{}');
begin
  perform public.map_require_admin();
  if not exists (select 1 from public.map_geometry_ids where id = p_edge_id and kind = 'edge') then
    raise exception '"%" is not a corridor stretch on the map.', p_edge_id;
  end if;
  if not v_tags <@ array['steps', 'ramp', 'narrow', 'outdoor']::text[] then
    raise exception 'Tags can only be: steps, ramp, narrow, outdoor.';
  end if;
  insert into public.map_overrides (kind, target_id, tags)
  values ('edge', p_edge_id, v_tags)
  on conflict (kind, target_id) do update set tags = excluded.tags;
  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (auth.uid(), 'map_edge_tagged', 'map_overrides', p_edge_id, jsonb_build_object('tags', v_tags));
end;
$$;

-- -----------------------------------------------------------------------------
-- map_save_connectors(list): replaces the whole set of stairs and lifts in one
-- transaction (what the editor's Save button sends). Each item:
--   {id?, type, name, floors: [...], positions: {floor: {x, y}}, accessible?, available?}
-- Items keep their id, so a lift marked out of order keeps its link to the
-- report about it. Items left out of the list are removed.
-- Checks: type, a unique name, floors that exist, a position on every floor
-- served. Whether a position is on a corridor needs the geometry, so the
-- editor checks that (linkConnectors) and blocks Save on errors.
-- -----------------------------------------------------------------------------
create function public.map_save_connectors(p_connectors jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_floors text[];
  v_item jsonb;
  v_n int;
  v_id uuid;
  v_type text;
  v_name text;
  v_names text[] := '{}';
  v_ids uuid[] := '{}';
  v_item_floors text[];
  v_floor text;
  v_point jsonb;
  v_positions jsonb;
  v_before int;
  v_removed int;
  v_added int := 0;
begin
  perform public.map_require_admin();
  if jsonb_typeof(p_connectors) is distinct from 'array' then
    raise exception 'Expected a list of stairs and lifts.';
  end if;

  -- One save at a time, so two admins can't interleave and break the name check.
  lock table public.map_connectors in share row exclusive mode;

  v_floors := array(select distinct floor from public.map_geometry_ids order by floor);
  select count(*) into v_before from public.map_connectors;

  -- First pass: check everything before changing anything.
  for v_item, v_n in select value, ordinality from jsonb_array_elements(p_connectors) with ordinality loop
    v_type := v_item ->> 'type';
    if v_type is null or v_type not in ('stairs', 'lift') then
      raise exception 'Item %: the type must be "stairs" or "lift".', v_n;
    end if;

    v_name := trim(coalesce(v_item ->> 'name', ''));
    if v_name = '' then
      raise exception 'Item %: every staircase and lift needs a name.', v_n;
    end if;
    if char_length(v_name) > 60 then
      raise exception '"%" is too long: use 60 characters or fewer.', v_name;
    end if;
    if lower(v_name) = any (v_names) then
      raise exception 'Two stairs or lifts can''t share a name: "%".', v_name;
    end if;
    v_names := v_names || lower(v_name);

    if nullif(v_item ->> 'id', '') is not null then
      begin
        v_id := (v_item ->> 'id')::uuid;
      exception when invalid_text_representation then
        raise exception '%: the id "%" is not valid.', v_name, v_item ->> 'id';
      end;
      if v_id = any (v_ids) then
        raise exception '% appears twice in the list.', v_name;
      end if;
      v_ids := v_ids || v_id;
    end if;

    if jsonb_typeof(v_item -> 'floors') is distinct from 'array'
       or jsonb_array_length(v_item -> 'floors') = 0 then
      raise exception '% needs at least one floor.', v_name;
    end if;
    for v_floor in select jsonb_array_elements_text(v_item -> 'floors') loop
      if not v_floor = any (v_floors) then
        raise exception '%: "%" is not a floor on the map. Use one of: %.',
          v_name, v_floor, array_to_string(v_floors, ', ');
      end if;
      v_point := v_item -> 'positions' -> v_floor;
      if jsonb_typeof(v_point -> 'x') is distinct from 'number'
         or jsonb_typeof(v_point -> 'y') is distinct from 'number' then
        raise exception '% has no position on floor %. Place it there or untick that floor.',
          v_name, v_floor;
      end if;
    end loop;

    if v_item ? 'accessible' and jsonb_typeof(v_item -> 'accessible') <> 'boolean' then
      raise exception '%: "accessible" must be true or false.', v_name;
    end if;
    if v_item ? 'available' and jsonb_typeof(v_item -> 'available') <> 'boolean' then
      raise exception '%: "available" must be true or false.', v_name;
    end if;
  end loop;

  -- Remove the ones that are no longer in the list.
  delete from public.map_connectors where not (id = any (v_ids));
  get diagnostics v_removed = row_count;

  -- Second pass: write. Positions keep only the floors served, as {x, y}.
  for v_item in select value from jsonb_array_elements(p_connectors) loop
    v_item_floors := array(select distinct f from jsonb_array_elements_text(v_item -> 'floors') as f order by f);
    select coalesce(jsonb_object_agg(f, jsonb_build_object(
             'x', (v_item -> 'positions' -> f ->> 'x')::numeric,
             'y', (v_item -> 'positions' -> f ->> 'y')::numeric)), '{}'::jsonb)
    into v_positions
    from unnest(v_item_floors) as f;

    v_id := nullif(v_item ->> 'id', '')::uuid;
    if v_id is null or not exists (select 1 from public.map_connectors where id = v_id) then
      v_added := v_added + 1;
    end if;

    insert into public.map_connectors (id, type, name, floors, positions, accessible, available)
    values (
      coalesce(v_id, gen_random_uuid()),
      (v_item ->> 'type')::public.map_connector_type,
      trim(v_item ->> 'name'),
      v_item_floors,
      v_positions,
      -- Default: lifts are step-free, stairs are not.
      coalesce((v_item ->> 'accessible')::boolean, v_item ->> 'type' = 'lift'),
      coalesce((v_item ->> 'available')::boolean, true)
    )
    on conflict (id) do update set
      type = excluded.type,
      name = excluded.name,
      floors = excluded.floors,
      positions = excluded.positions,
      accessible = excluded.accessible,
      available = excluded.available;
  end loop;

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    auth.uid(), 'map_connectors_saved', 'map_connectors', null,
    jsonb_build_object(
      'before', v_before,
      'after', jsonb_array_length(p_connectors),
      'added', v_added,
      'removed', v_removed,
      'list', p_connectors
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Presets
-- -----------------------------------------------------------------------------
create function public.map_check_preset_name(p_name text, p_except uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'Give the term a name, for example "Term 1".';
  end if;
  if char_length(v_name) > 40 then
    raise exception 'Use 40 characters or fewer for the term name.';
  end if;
  if exists (
    select 1 from public.map_presets
    where lower(name) = lower(v_name) and id is distinct from p_except
  ) then
    raise exception 'There is already a term called "%".', v_name;
  end if;
  return v_name;
end;
$$;

-- New preset, empty or copied from another one. Returns its id.
create function public.map_create_preset(p_name text, p_copy_from uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_id uuid;
  v_copied int := 0;
begin
  perform public.map_require_admin();
  v_name := public.map_check_preset_name(p_name, null);
  if p_copy_from is not null and not exists (select 1 from public.map_presets where id = p_copy_from) then
    raise exception 'The term to copy from doesn''t exist any more.';
  end if;

  insert into public.map_presets (name, created_by) values (v_name, auth.uid()) returning id into v_id;

  if p_copy_from is not null then
    insert into public.map_assignments (preset_id, region_id, name, subject, teacher, type)
    select v_id, region_id, name, subject, teacher, type
    from public.map_assignments where preset_id = p_copy_from;
    get diagnostics v_copied = row_count;
  end if;

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    auth.uid(), 'map_preset_created', 'map_presets', v_id::text,
    jsonb_build_object('name', v_name, 'copied_from', p_copy_from, 'rooms', v_copied)
  );
  return v_id;
end;
$$;

create function public.map_rename_preset(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
  v_name text;
begin
  perform public.map_require_admin();
  select name into v_old from public.map_presets where id = p_id;
  if not found then
    raise exception 'That term doesn''t exist any more.';
  end if;
  v_name := public.map_check_preset_name(p_name, p_id);
  update public.map_presets set name = v_name where id = p_id;
  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (auth.uid(), 'map_preset_renamed', 'map_presets', p_id::text,
          jsonb_build_object('old', v_old, 'new', v_name));
end;
$$;

-- Deletes a preset that is not active. Its room names are copied into the
-- audit log first, so a deleted term can be rebuilt from there.
create function public.map_delete_preset(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preset public.map_presets;
begin
  perform public.map_require_admin();
  select * into v_preset from public.map_presets where id = p_id for update;
  if not found then
    raise exception 'That term doesn''t exist any more.';
  end if;
  if exists (select 1 from public.app_settings where map_active_preset_id = p_id) then
    raise exception 'You can''t delete the active term. Make another term active first.';
  end if;

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    auth.uid(), 'map_preset_deleted', 'map_presets', p_id::text,
    jsonb_build_object(
      'name', v_preset.name,
      'rooms', coalesce((
        select jsonb_agg(jsonb_build_object(
          'room_id', region_id, 'name', name, 'subject', subject, 'teacher', teacher, 'type', type
        ) order by region_id)
        from public.map_assignments where preset_id = p_id
      ), '[]'::jsonb)
    )
  );
  delete from public.map_presets where id = p_id;
end;
$$;

-- One action switches what every student sees.
create function public.map_set_active_preset(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old uuid;
begin
  perform public.map_require_admin();
  if p_id is not null and not exists (select 1 from public.map_presets where id = p_id) then
    raise exception 'That term doesn''t exist any more.';
  end if;
  select map_active_preset_id into v_old from public.app_settings;
  update public.app_settings set map_active_preset_id = p_id where true;
  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    auth.uid(), 'map_preset_activated', 'app_settings', p_id::text,
    jsonb_build_object(
      'old', v_old, 'old_name', (select name from public.map_presets where id = v_old),
      'new', p_id, 'new_name', (select name from public.map_presets where id = p_id)
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Room names. Both save and import take a list of
--   {room_id, name, subject?, teacher?, type?, row?}
-- and replace the preset's whole set. `row` is the line number to use in
-- messages (the CSV line on import); without it, the position in the list.
-- Rows with an empty name are left out: that room becomes unnamed.
-- Any problem refuses the whole save, with every message on its own line.
-- -----------------------------------------------------------------------------
create function public.map_write_assignments(p_preset_id uuid, p_rows jsonb, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_n int;
  v_row int;
  v_room text;
  v_name text;
  v_type text;
  v_problems text[] := '{}';
  v_types text[] := enum_range(null::public.map_room_type)::text[];
  v_before jsonb;
  v_after jsonb;
begin
  perform public.map_require_admin();
  if not exists (select 1 from public.map_presets where id = p_preset_id) then
    raise exception 'That term doesn''t exist any more.';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Expected a list of rooms.';
  end if;

  -- Checked rows land here first, so nothing is written unless all are fine.
  -- (Dropped first in case this runs twice in one transaction.)
  drop table if exists pg_temp.map_rows_in;
  create temporary table map_rows_in (
    row_no int, room_id text, name text, subject text, teacher text, type text
  ) on commit drop;

  for v_item, v_n in select value, ordinality from jsonb_array_elements(p_rows) with ordinality loop
    v_row := coalesce((v_item ->> 'row')::int, v_n::int);
    v_room := trim(coalesce(v_item ->> 'room_id', ''));
    v_name := trim(coalesce(v_item ->> 'name', ''));
    v_type := lower(trim(coalesce(v_item ->> 'type', '')));

    if v_room = '' then
      v_problems := v_problems || format('Row %s: the room_id is empty.', v_row);
      continue;
    end if;
    if not exists (select 1 from public.map_geometry_ids where id = v_room and destination) then
      v_problems := v_problems || format('Row %s: "%s" is not a room on the map.', v_row, v_room);
      continue;
    end if;
    if exists (select 1 from pg_temp.map_rows_in where room_id = v_room) then
      v_problems := v_problems || format('Row %s: %s already appears on row %s.', v_row, v_room,
        (select row_no from pg_temp.map_rows_in where room_id = v_room limit 1));
      continue;
    end if;
    if v_type <> '' and not v_type = any (v_types) then
      v_problems := v_problems || format('Row %s: "%s" is not a room type. Use one of: %s.',
        v_row, v_item ->> 'type', array_to_string(v_types, ', '));
      continue;
    end if;
    if char_length(v_name) > 80 then
      v_problems := v_problems || format('Row %s: the name is too long (80 characters at most).', v_row);
      continue;
    end if;
    if v_name <> '' and exists (select 1 from pg_temp.map_rows_in where lower(name) = lower(v_name)) then
      v_problems := v_problems || format('Two rooms can''t share a name: "%s" is already used by %s.',
        v_name, (select room_id from pg_temp.map_rows_in where lower(name) = lower(v_name) limit 1));
      continue;
    end if;

    insert into pg_temp.map_rows_in values (
      v_row, v_room, v_name,
      trim(coalesce(v_item ->> 'subject', '')),
      trim(coalesce(v_item ->> 'teacher', '')),
      coalesce(nullif(v_type, ''), 'other')
    );
  end loop;

  if cardinality(v_problems) > 0 then
    raise exception '%', array_to_string(v_problems[1:20], E'\n')
      using hint = format('%s problem(s) in total. Nothing was saved.', cardinality(v_problems));
  end if;

  -- What changed, for the audit log: old and new values of each room touched.
  select coalesce(jsonb_object_agg(region_id, jsonb_build_object(
           'name', name, 'subject', subject, 'teacher', teacher, 'type', type)), '{}'::jsonb)
  into v_before
  from public.map_assignments where preset_id = p_preset_id;

  delete from public.map_assignments where preset_id = p_preset_id;
  insert into public.map_assignments (preset_id, region_id, name, subject, teacher, type)
  select p_preset_id, room_id, name, subject, teacher, type::public.map_room_type
  from pg_temp.map_rows_in
  where name <> '';

  select coalesce(jsonb_object_agg(region_id, jsonb_build_object(
           'name', name, 'subject', subject, 'teacher', teacher, 'type', type)), '{}'::jsonb)
  into v_after
  from public.map_assignments where preset_id = p_preset_id;

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    auth.uid(), p_action, 'map_assignments', p_preset_id::text,
    jsonb_build_object(
      'preset', (select name from public.map_presets where id = p_preset_id),
      'rooms', (select count(*) from public.map_assignments where preset_id = p_preset_id),
      'changes', coalesce((
        select jsonb_object_agg(k, jsonb_build_object('old', v_before -> k, 'new', v_after -> k))
        from (
          select key as k from jsonb_object_keys(v_before) as key
          union
          select key from jsonb_object_keys(v_after) as key
        ) keys
        where (v_before -> k) is distinct from (v_after -> k)
      ), '{}'::jsonb)
    )
  );
end;
$$;

-- The shared worker above is not callable from the app; these two are.
revoke execute on function public.map_write_assignments(uuid, jsonb, text) from public, anon, authenticated;

-- Save from the Classrooms editor (one room renamed, or a few changed).
create function public.map_save_assignments(p_preset_id uuid, p_rows jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.map_write_assignments(p_preset_id, p_rows, 'map_assignments_saved');
$$;

-- Apply a CSV import (already previewed in the app).
create function public.map_import_assignments(p_preset_id uuid, p_rows jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.map_write_assignments(p_preset_id, p_rows, 'map_assignments_imported');
$$;

-- -----------------------------------------------------------------------------
-- Realtime: open maps refresh when stairs, lifts, flags or names change, and
-- when the active preset is switched (app_settings).
-- -----------------------------------------------------------------------------
-- Each table is added only if it isn't in the publication already (someone
-- may have switched Realtime on for app_settings in the dashboard), because
-- adding a table twice is an error that would stop the whole migration.
do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'No supabase_realtime publication: skipping Realtime setup.';
    return;
  end if;
  if (select puballtables from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime already covers every table: nothing to add.';
    return;
  end if;
  foreach v_table in array array['map_connectors', 'map_overrides', 'map_presets', 'map_assignments', 'app_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
