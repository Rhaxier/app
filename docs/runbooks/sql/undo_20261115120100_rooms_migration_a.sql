-- =============================================================================
-- UNDO rooms migration step A (20261115120100_rooms_migration_a.sql).
-- Run by hand only (SQL editor or psql). Never picked up by `supabase db push`.
--
-- Removes only what step A added: the traced rooms, floor 3, the three helper
-- tables, the fill function and the two new columns. The 15 placeholder
-- rooms and every report, venue and event stay as they are.
--
-- It refuses to run (and changes nothing) if step B has started, or if
-- anything already points at a traced room: then the step B undo comes first.
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from public.rooms where retired_at is not null) then
    raise exception 'Some rooms are retired, so step B has run. Undo step B first.';
  end if;
  if exists (select 1 from public.reports r join public.rooms o on o.id = r.room_id where o.region_id is not null)
     or exists (select 1 from public.venues v join public.rooms o on o.id = v.room_id where o.region_id is not null)
     or exists (select 1 from public.volunteer_events e join public.rooms o on o.id = e.room_id where o.region_id is not null)
  then
    raise exception 'A report, venue or event uses a traced room. Undo step B first (or move it back to a placeholder).';
  end if;
  if exists (select 1 from public.rooms where floor_id = (select id from public.floors where name = '3') and region_id is null) then
    raise exception 'Floor 3 has a room that step A did not add. Move or remove it first.';
  end if;
end;
$$;

drop function public.room_migration_a_fill();
drop table public.room_migration_backup, public.room_migration_map, public.room_migration_traced;
delete from public.rooms where region_id is not null;
delete from public.floors where name = '3';
alter table public.floors alter column image_path set not null;
alter table public.rooms drop column region_id, drop column retired_at;

-- Tell the Supabase CLI the migration is no longer applied (skipped where the
-- table doesn't exist, e.g. a database set up without the CLI).
do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261115120100';
  end if;
end;
$$;

commit;
