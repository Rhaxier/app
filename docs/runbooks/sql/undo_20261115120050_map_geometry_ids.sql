-- =============================================================================
-- UNDO 20261115120050_map_geometry_ids.sql on its own: empties the list of
-- map ids. Run by hand only (SQL Editor).
--
-- While the list is empty, the map functions refuse every room, door and
-- corridor id, so admins can't save room names or mark doors out of order.
-- Usually you undo part 1 as a whole instead: undo_20261115120000_map_nav.sql
-- removes this table along with the rest. This file is for re-loading the
-- list (run it, then paste 20261115120050 again).
-- =============================================================================
begin;

delete from public.map_geometry_ids;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute $sql$delete from supabase_migrations.schema_migrations where version = '20261115120050'$sql$;
  end if;
end;
$$;

commit;
