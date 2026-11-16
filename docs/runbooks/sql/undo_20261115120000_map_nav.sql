-- =============================================================================
-- UNDO the indoor-navigation tables (20261115120000_map_nav.sql and
-- 20261115120050_map_geometry_ids.sql). Run by hand only, AFTER the step A
-- undo if step A was applied (step A must be undone first).
--
-- WARNING: this removes the stairs and lifts admins placed, the terms and
-- their room names, and the out-of-order flags. Export them first (runbook,
-- "Before undoing the map tables"). The audit log keeps its rows.
-- =============================================================================
begin;

do $$
begin
  if to_regclass('public.room_migration_traced') is not null then
    raise exception 'Rooms migration step A is still applied. Run its undo first.';
  end if;
end;
$$;

-- Realtime: the map tables leave the publication by themselves when they are
-- dropped below. app_settings stays a table, so it is taken out here, unless
-- it was already sent through Realtime before part 1 (part 1 preflight,
-- row 6). In that case change `true` to `false` on the marked line.
do $$
declare
  -- >>> false if the part 1 preflight's row 6 said "yes" <<<
  v_remove_app_settings boolean := true;
begin
  if v_remove_app_settings and exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime drop table public.app_settings;
  end if;
end;
$$;

drop function public.map_import_assignments(uuid, jsonb);
drop function public.map_save_assignments(uuid, jsonb);
drop function public.map_write_assignments(uuid, jsonb, text);
drop function public.map_set_active_preset(uuid);
drop function public.map_delete_preset(uuid);
drop function public.map_rename_preset(uuid, text);
drop function public.map_create_preset(text, uuid);
drop function public.map_check_preset_name(text, uuid);
drop function public.map_save_connectors(jsonb);
drop function public.map_set_edge_tags(text, text[]);
drop function public.map_set_available(text, text, boolean);
drop function public.map_require_admin();
drop function public.map_can_mark_out_of_order();

alter table public.app_settings drop column map_active_preset_id;
drop table public.map_assignments, public.map_presets, public.map_overrides,
  public.map_connectors, public.map_geometry_ids;
drop type public.map_room_type, public.map_override_kind, public.map_connector_type;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations
    where version in ('20261115120000', '20261115120050');
  end if;
end;
$$;

commit;
