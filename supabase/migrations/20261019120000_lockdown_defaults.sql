-- =============================================================================
-- 00 Lock down defaults
--
-- Supabase gives two database roles to people using the app:
--   anon          = not signed in (anyone on the internet with the app's URL)
--   authenticated = signed in
-- By default Supabase grants both of them access to every new table and
-- function in the public schema, and Postgres lets every role run every new
-- function. RLS still protects table rows, but we'd rather start from "no":
--
--   * Signed-out visitors get nothing. The app has no public pages.
--   * New functions are not runnable by anyone unless a later migration says so
--     (signed-in users still get them through Supabase's own default grant,
--     and internal helpers revoke that grant explicitly).
--
-- These lines only affect objects created AFTER this migration, which is why
-- this file runs first.
-- =============================================================================

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- Postgres's built-in default is "PUBLIC (every role) may execute new functions".
alter default privileges revoke execute on functions from public;
