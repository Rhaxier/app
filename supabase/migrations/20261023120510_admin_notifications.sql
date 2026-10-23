-- =============================================================================
-- 17 Notifications admin (admin dashboard, B6).
--
-- Emergency broadcast
--   announcements.urgent; table emergency_broadcasts (the record and the rate
--   limit); admin_emergency_broadcast(title, message).
-- Staff email
--   table staff_email_prefs (per staff member: on/off, immediate or digest),
--   read by notify(); app_settings.digest_time and email_digest_due() /
--   mark_email_digest_sent() for the send-emails function's daily digest.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Emergency broadcast
-- -----------------------------------------------------------------------------
alter table public.announcements add column urgent boolean not null default false;

create table public.emergency_broadcasts (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid references public.profiles (id) on delete set null,
  title text not null,
  message text not null,
  announcement_id uuid references public.announcements (id) on delete set null,
  recipients int not null,
  created_at timestamptz not null default now()
);

alter table public.emergency_broadcasts enable row level security;
-- Admins read the history. Nobody writes it directly: only the function does.
create policy "Admins read emergency broadcasts" on public.emergency_broadcasts
for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.emergency_broadcasts from authenticated;

-- Only admins may mark an announcement urgent (the broadcast does it).
create function public.announcements_protect_urgent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and pg_trigger_depth() = 1 and not public.is_admin()
     and new.urgent and (tg_op = 'INSERT' or not old.urgent) then
    raise exception 'Only admins can send an emergency announcement.';
  end if;
  return new;
end;
$$;

create trigger announcements_protect_urgent
before insert or update on public.announcements
for each row execute function public.announcements_protect_urgent();

-- Emergency announcements are announced by the broadcast itself (one urgent
-- notification each); the ordinary "new announcement" one would be a duplicate.
create or replace function public.send_announcement_notifications(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.announcements;
  v_body text;
  v_link text := '/announcements/' || p_id;
begin
  select * into a from public.announcements where id = p_id;
  v_body := left(a.body, 140);
  if a.urgent then
    null;
  elsif a.audience = 'grades' then
    perform public.notify(p.id, 'announcement_new', a.title, v_body, v_link)
    from public.profiles p
    where p.role = 'student' and p.grade = any (a.grades)
      and (
        a.section_ids is null
        or exists (
          select 1 from public.sections s
          where s.id = any (a.section_ids) and s.grade = p.grade and lower(s.name) = lower(trim(p.section))
        )
      );
  elsif a.pinned then
    perform public.notify(p.id, 'announcement_new', a.title, v_body, v_link)
    from public.profiles p
    where p.id <> a.author_id;
  end if;
  update public.announcements set notified_at = now() where id = p_id;
end;
$$;

-- An emergency message: a pinned, urgent, school-wide announcement, plus an
-- urgent notification to every active person (phone push for everyone,
-- immediate email for staff who get email). At most one every 10 minutes, so a
-- double tap or two admins at once can't send it twice. Returns how many
-- people were notified.
create function public.admin_emergency_broadcast(p_title text, p_message text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last public.emergency_broadcasts;
  v_announcement uuid;
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Only admins can send an emergency message.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 80 then
    raise exception 'Give it a short title (up to 80 characters).';
  end if;
  if char_length(trim(coalesce(p_message, ''))) not between 1 and 500 then
    raise exception 'Write the message (up to 500 characters).';
  end if;

  -- One at a time: a second call waits here for the first to finish, then
  -- sees its row and is refused.
  perform pg_advisory_xact_lock(hashtext('emergency_broadcast'));
  select * into v_last from public.emergency_broadcasts
  where created_at > now() - interval '10 minutes'
  order by created_at desc limit 1;
  if found then
    raise exception 'An emergency message already went out at % ("%"). Wait 10 minutes before sending another.',
      to_char(v_last.created_at at time zone 'Asia/Dubai', 'FMHH24:MI'), v_last.title;
  end if;

  -- The feed labels it "Emergency · <sender>", so no "post as" name is needed.
  insert into public.announcements (author_id, title, body, audience, pinned, urgent)
  values (auth.uid(), trim(p_title), trim(p_message), 'school', true, true)
  returning id into v_announcement;

  select count(*)::int into v_count from (
    select public.notify(p.id, 'emergency', trim(p_title), trim(p_message),
                         '/announcements/' || v_announcement, true)
    from public.profiles p
    where p.archived_at is null
  ) sent;

  insert into public.emergency_broadcasts (sent_by, title, message, announcement_id, recipients)
  values (auth.uid(), trim(p_title), trim(p_message), v_announcement, v_count);

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (auth.uid(), 'emergency_broadcast', 'announcements', v_announcement::text,
          jsonb_build_object('title', trim(p_title), 'recipients', v_count));
  return v_count;
end;
$$;

-- Emergencies can never be muted.
create or replace function public.notification_type_is_unmutable(p_type public.notification_type)
returns boolean
language sql
immutable
as $$
  select p_type in (
    'report_new',
    'vol_event_pending_approval',
    'booking_awaiting_teacher',
    'booking_pending',
    'booking_reminder',
    'emergency'
  );
$$;

-- -----------------------------------------------------------------------------
-- Which staff get email, and how (extends Q15)
-- -----------------------------------------------------------------------------
create type public.email_mode as enum ('immediate', 'digest');

create table public.staff_email_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  enabled boolean not null default true,
  -- immediate: every email at once. digest: one daily email (urgent ones still at once).
  mode public.email_mode not null default 'digest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_email_prefs_updated_at before update on public.staff_email_prefs
for each row execute function public.set_updated_at();
create trigger staff_email_prefs_audit after insert or update or delete on public.staff_email_prefs
for each row execute function public.audit_change();

create function public.staff_email_prefs_staff_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff_member(new.user_id) then
    raise exception 'Email settings are for teachers and admins.';
  end if;
  return new;
end;
$$;

create trigger staff_email_prefs_staff_only before insert or update on public.staff_email_prefs
for each row execute function public.staff_email_prefs_staff_only();

alter table public.staff_email_prefs enable row level security;
create policy "Staff read their own email setting, admins all" on public.staff_email_prefs
for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Admins manage staff email settings" on public.staff_email_prefs for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- notify(), as in 12, deciding email from the staff member's setting when
-- there is one, and otherwise as before (only people holding a responsibility).
create or replace function public.notify(
  p_recipient uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_link text,
  p_urgent boolean default false,
  p_email_now boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_payload jsonb;
  v_pref public.staff_email_prefs;
  v_email boolean;
begin
  if p_recipient is null
     or exists (select 1 from public.profiles where id = p_recipient and archived_at is not null) then
    return null;
  end if;

  if not p_urgent
     and not public.notification_type_is_unmutable(p_type)
     and exists (
       select 1 from public.notification_prefs
       where user_id = p_recipient and type = p_type and muted
     ) then
    return null;
  end if;

  insert into public.notifications (recipient_id, type, title, body, link, urgent)
  values (p_recipient, p_type, p_title, coalesce(p_body, ''), p_link, p_urgent)
  returning id into v_id;

  v_payload := jsonb_build_object(
    'type', p_type, 'title', p_title, 'body', coalesce(p_body, ''), 'link', p_link, 'urgent', p_urgent
  );

  insert into public.push_outbox (recipient_id, notification_id, kind, payload)
  values (p_recipient, v_id, 'immediate', v_payload);

  select * into v_pref from public.staff_email_prefs where user_id = p_recipient;
  v_email := case
    when v_pref.id is not null then v_pref.enabled
    else exists (select 1 from public.responsibilities where user_id = p_recipient)
  end;

  if v_email then
    insert into public.email_outbox (recipient_id, notification_id, kind, payload)
    values (
      p_recipient,
      v_id,
      case when p_urgent or p_email_now or v_pref.mode = 'immediate' then 'immediate'::public.outbox_kind
           else 'digest' end,
      v_payload || jsonb_build_object(
        'email', (select email from public.profiles where id = p_recipient)
      )
    );
  end if;

  return v_id;
end;
$$;

revoke execute on function public.notify(uuid, public.notification_type, text, text, text, boolean, boolean)
  from public, anon, authenticated;

-- The admin list: every teacher and admin with their effective email setting.
create function public.admin_staff_email_settings()
returns table (
  user_id uuid,
  full_name text,
  email text,
  role public.user_role,
  responsibilities public.responsibility_kind[],
  has_setting boolean,
  enabled boolean,
  mode public.email_mode
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see staff email settings.' using errcode = '42501';
  end if;
  return query
    select
      p.id, p.full_name, p.email, p.role,
      coalesce(array_agg(r.kind order by r.kind) filter (where r.kind is not null), '{}'),
      s.id is not null,
      coalesce(s.enabled, count(r.kind) > 0),
      coalesce(s.mode, 'digest')
    from public.profiles p
    left join public.responsibilities r on r.user_id = p.id
    left join public.staff_email_prefs s on s.user_id = p.id
    where p.role in ('teacher', 'admin') and p.archived_at is null
    group by p.id, s.id
    order by p.full_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- The daily digest's time (Asia/Dubai). The send-emails function asks
-- email_digest_due() each time it runs (hourly), sends the digest once the
-- time has passed, then calls mark_email_digest_sent().
-- -----------------------------------------------------------------------------
alter table public.app_settings
  add column digest_time time not null default '07:00',
  add column digest_last_sent_on date;

create function public.email_digest_due()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone 'Asia/Dubai')::time >= s.digest_time
     and s.digest_last_sent_on is distinct from (now() at time zone 'Asia/Dubai')::date
  from public.app_settings s;
$$;

create function public.mark_email_digest_sent()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.app_settings set digest_last_sent_on = (now() at time zone 'Asia/Dubai')::date;
$$;

-- For the Edge Function (service role) only.
revoke execute on function public.email_digest_due() from public, anon, authenticated;
revoke execute on function public.mark_email_digest_sent() from public, anon, authenticated;
grant execute on function public.email_digest_due() to service_role;
grant execute on function public.mark_email_digest_sent() to service_role;
