-- =============================================================================
-- 02 Notifications, shared by every feature.
--
-- Tables:    notifications, notification_prefs, email_outbox, push_outbox
-- Functions: notify(), notify_responsibility(), notification_type_is_unmutable()
--
-- How it works: feature triggers call notify(). notify() checks the recipient's
-- mutes, writes the in-app notification (the bell / inbox, delivered live by
-- Realtime), and queues a phone push and, for staff with responsibilities, an
-- email. Nothing is sent yet: the send-emails and send-push Edge Functions
-- will read the outboxes (docs/OPEN_QUESTIONS.md, Q7 and Q8).
--
-- The app itself can never create a notification. Only triggers can, so a bug
-- on one screen can't skip or fake one.
-- =============================================================================

create type public.notification_type as enum (
  'announcement_new',
  'report_new',
  'report_status',
  'collab_request_new',
  'collab_request_accepted',
  'collab_request_declined',
  'vol_event_pending_approval',
  'vol_event_approved',
  'vol_event_sent_back',
  'vol_signup_new',
  'vol_selected',
  'vol_waitlisted',
  'vol_withdrawal',
  'booking_awaiting_teacher',
  'booking_pending',
  'booking_approved',
  'booking_rejected',
  'booking_reminder',
  'project_shared',
  'project_feedback'
);

create type public.outbox_kind as enum ('immediate', 'digest');
create type public.outbox_status as enum ('queued', 'sent', 'failed');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null default '',
  link text, -- an app route to open, e.g. '/volunteer/<id>'
  urgent boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

-- One row per muted type per person. No row = not muted.
create table public.notification_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  muted boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, type)
);

create trigger notification_prefs_updated_at
before update on public.notification_prefs
for each row execute function public.set_updated_at();

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  notification_id uuid references public.notifications (id) on delete cascade,
  kind public.outbox_kind not null,
  status public.outbox_status not null default 'queued',
  payload jsonb not null default '{}',
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_outbox_queued_idx on public.email_outbox (kind, created_at) where status = 'queued';

create trigger email_outbox_updated_at
before update on public.email_outbox
for each row execute function public.set_updated_at();

create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  notification_id uuid references public.notifications (id) on delete cascade,
  kind public.outbox_kind not null,
  status public.outbox_status not null default 'queued',
  payload jsonb not null default '{}',
  attempts int not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_outbox_queued_idx on public.push_outbox (created_at) where status = 'queued';

create trigger push_outbox_updated_at
before update on public.push_outbox
for each row execute function public.set_updated_at();

-- Notification text shows times the way the app does: Dubai time, e.g.
-- "Sun 18 Oct, 7:00". The app formats its own screens in src/lib/dates.ts.
create function public.format_school_time(p_time timestamptz)
returns text
language sql
stable
as $$
  select to_char(p_time at time zone 'Asia/Dubai', 'Dy FMDD Mon, FMHH24:MI');
$$;

-- -----------------------------------------------------------------------------
-- Approvals and other "someone is waiting on you" types can't be muted.
-- The app's settings screen mirrors this list (src/features/notifications/types.ts).
-- -----------------------------------------------------------------------------
create function public.notification_type_is_unmutable(p_type public.notification_type)
returns boolean
language sql
immutable
as $$
  select p_type in (
    'report_new',
    'vol_event_pending_approval',
    'booking_awaiting_teacher',
    'booking_pending',
    'booking_reminder'
  );
$$;

-- -----------------------------------------------------------------------------
-- notify(): the one way any notification is created.
--   p_urgent     urgent items can't be muted and email immediately
--   p_email_now  email immediately even if not urgent (venue approvals)
-- Returns the notification id, or null if the recipient muted this type.
-- -----------------------------------------------------------------------------
create function public.notify(
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
begin
  if p_recipient is null then
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

  -- Everyone with the phone app gets a push (once push is switched on).
  insert into public.push_outbox (recipient_id, notification_id, kind, payload)
  values (p_recipient, v_id, 'immediate', v_payload);

  -- Staff with responsibilities may not open the app daily, so they also get
  -- email: immediately when it's urgent, otherwise in the daily digest.
  if exists (select 1 from public.responsibilities where user_id = p_recipient) then
    insert into public.email_outbox (recipient_id, notification_id, kind, payload)
    values (
      p_recipient,
      v_id,
      case when p_urgent or p_email_now then 'immediate'::public.outbox_kind else 'digest' end,
      v_payload || jsonb_build_object(
        'email', (select email from public.profiles where id = p_recipient)
      )
    );
  end if;

  return v_id;
end;
$$;

-- Notify everyone holding a responsibility, e.g. all IT staff. Returns how many.
create function public.notify_responsibility(
  p_kind public.responsibility_kind,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_link text,
  p_urgent boolean default false,
  p_email_now boolean default false
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
  v_user uuid;
begin
  for v_user in select user_id from public.responsibilities where kind = p_kind loop
    perform public.notify(v_user, p_type, p_title, p_body, p_link, p_urgent, p_email_now);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- These run only inside triggers. Without this, anyone signed in could call
-- notify() through the API and send fake notifications.
revoke execute on function public.notify(uuid, public.notification_type, text, text, text, boolean, boolean)
  from public, anon, authenticated;
revoke execute on function public.notify_responsibility(
  public.responsibility_kind, public.notification_type, text, text, text, boolean, boolean
) from public, anon, authenticated;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.email_outbox enable row level security;
alter table public.push_outbox enable row level security;

create policy "Read own notifications"
on public.notifications for select to authenticated
using (recipient_id = (select auth.uid()));

create policy "Mark own notifications read"
on public.notifications for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

-- No insert or delete policy, and only the read_at column can be updated.
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Manage own notification settings"
on public.notification_prefs for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Outboxes are read by the Edge Functions with the service role key, which
-- bypasses RLS. Admins can look at them to check what would be sent.
create policy "Admins read the email outbox"
on public.email_outbox for select to authenticated
using (public.is_admin());

create policy "Admins read the push outbox"
on public.push_outbox for select to authenticated
using (public.is_admin());

revoke insert, update, delete on public.email_outbox, public.push_outbox from authenticated;
