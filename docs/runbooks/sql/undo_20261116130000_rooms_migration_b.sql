-- =============================================================================
-- UNDO part 4: removes the release tools (20261116130000_rooms_migration_b.sql).
-- Run by hand only, and only when NOT released: if the indoor map is live,
-- run `select public.room_migration_b_undo();` first (this refuses otherwise).
-- Safe to run in any state.
-- =============================================================================
begin;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'app_settings'
               and column_name = 'map_indoor_live') then
    if (select map_indoor_live from public.app_settings) then
      raise exception 'The indoor map is live. Run select public.room_migration_b_undo(); first.';
    end if;
  end if;
end;
$$;

drop trigger if exists map_assignments_sync_rooms on public.map_assignments;
drop trigger if exists app_settings_sync_rooms on public.app_settings;
drop function if exists public.room_migration_b_apply();
drop function if exists public.room_migration_b_undo();
drop function if exists public.rooms_sync_names_trigger();
drop function if exists public.rooms_sync_names();
drop table if exists public.room_migration_floors_backup;
alter table public.app_settings drop column if exists map_indoor_live;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261116130000';
  end if;
end;
$$;

commit;
