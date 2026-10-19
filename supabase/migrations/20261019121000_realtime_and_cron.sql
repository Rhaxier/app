-- =============================================================================
-- 10 Realtime and scheduled jobs.
--
-- Realtime: the app subscribes to changes on these tables so screens update
-- the moment something happens (the bell's unread badge; a booking approved
-- while the calendar is open; a new fix-it pin). Realtime respects RLS and
-- column privileges, so people only hear about rows they could read anyway.
--
-- Cron (Q10): venue_reminders() runs every hour where pg_cron is available
-- (Supabase has it). Elsewhere this step is skipped with a notice, and the
-- reminders can be run by hand: select public.venue_reminders();
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.bookings, public.reports;
  else
    raise notice 'No supabase_realtime publication: skipping Realtime setup.';
  end if;
end;
$$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('venue-reminders', '0 * * * *', 'select public.venue_reminders();');
exception when others then
  raise notice 'pg_cron is not available (%), so venue reminders are not scheduled. See docs/OPEN_QUESTIONS.md, Q10.', sqlerrm;
end;
$$;
