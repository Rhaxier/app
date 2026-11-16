-- =============================================================================
-- Tells the Supabase CLI that migrations applied by hand in the SQL Editor
-- are applied, so a later `supabase db push` doesn't try to run them again.
-- Does nothing on a project without the CLI's history table.
--
-- Edit the list on the marked line before running:
--   after part 1: '20261115120000', '20261115120050'
--   after part 2: '20261115120100'
--   after part 3: '20261116120000'
--   after part 4: '20261116130000' (part 5, the release, is not a migration)
-- =============================================================================
do $$
declare
  -- >>> the versions just applied <<<
  v_versions text[] := array['20261115120000', '20261115120050'];
  v_version text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'No migration history table: nothing to record.';
    return;
  end if;
  foreach v_version in array v_versions loop
    -- Older CLI versions keep only the version, newer ones a name too.
    if exists (select 1 from information_schema.columns
               where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
                 and column_name = 'name') then
      execute format(
        'insert into supabase_migrations.schema_migrations (version, name) values (%L, %L)
         on conflict (version) do nothing',
        v_version,
        case v_version
          when '20261115120000' then 'map_nav'
          when '20261115120050' then 'map_geometry_ids'
          when '20261115120100' then 'rooms_migration_a'
          when '20261114120000' then 'after_school_booking'
          when '20261116120000' then 'report_map_target'
          when '20261116130000' then 'rooms_migration_b'
        end
      );
    else
      execute format(
        'insert into supabase_migrations.schema_migrations (version) values (%L)
         on conflict (version) do nothing',
        v_version
      );
    end if;
    raise notice 'Recorded %', v_version;
  end loop;
end;
$$;
