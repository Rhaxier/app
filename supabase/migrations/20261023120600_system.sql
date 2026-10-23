-- =============================================================================
-- 18 System (admin dashboard, B7).
--
-- Feature switches  feature_flags; feature_enabled(); new rows for a switched-
--                   off feature are refused for everyone but admins.
-- Branding          app_settings.logo_url, accent_color (checked: white text on
--                   it must reach 4.5:1); bucket `branding`.
-- Maintenance       app_settings.maintenance_enabled / _message / _until.
-- Public status     public_status(): name, logo, accent and any maintenance
--                   message, for every screen including sign-in.
-- Exports           admin_export_bookings(), admin_export_reports() (users and
--                   SUPW hours use admin_list_users() and supw_hours_report()).
-- Deletion          profiles.anonymised_at; admin_user_files();
--                   admin_anonymise_user() (typed confirmation).
-- Audit log         indexes and admin_audit_filters() for the viewer.
-- =============================================================================

-- =============================================================================
-- Feature switches
-- =============================================================================
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  feature text not null unique check (
    feature in ('announcements', 'volunteering', 'projects', 'collab', 'venues', 'map', 'fixit')
  ),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (feature)
values ('announcements'), ('volunteering'), ('projects'), ('collab'), ('venues'), ('map'), ('fixit');

create trigger feature_flags_updated_at before update on public.feature_flags
for each row execute function public.set_updated_at();
create trigger feature_flags_audit after insert or update or delete on public.feature_flags
for each row execute function public.audit_change();

alter table public.feature_flags enable row level security;
create policy "Everyone reads feature switches" on public.feature_flags
for select to authenticated using (true);
create policy "Admins flip feature switches" on public.feature_flags for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- A feature with no row counts as on.
create function public.feature_enabled(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select enabled from public.feature_flags where feature = p_feature), true);
$$;

-- The clear message, before RLS refuses the same insert (policies below).
-- The feature's name is passed in where the trigger is attached.
create function public.block_disabled_feature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feature text := tg_argv[0];
begin
  if auth.uid() is not null and not public.is_admin() and not public.feature_enabled(v_feature) then
    raise exception '% is switched off at the moment. Existing content can still be read.',
      case v_feature
        when 'fixit' then 'Fix-it reports'
        when 'venues' then 'Venue booking'
        else initcap(v_feature)
      end;
  end if;
  return new;
end;
$$;

-- One trigger and one restrictive policy per table a feature lets people add to.
do $$
declare
  v_pair text[];
begin
  foreach v_pair slice 1 in array array[
    ['announcements', 'announcements'],
    ['volunteer_events', 'volunteering'],
    ['role_signups', 'volunteering'],
    ['projects', 'projects'],
    ['project_shares', 'projects'],
    ['project_feedback', 'projects'],
    ['collab_posts', 'collab'],
    ['join_requests', 'collab'],
    ['bookings', 'venues'],
    ['reports', 'fixit'],
    ['report_votes', 'fixit']
  ] loop
    execute format(
      'create trigger block_disabled_feature before insert on public.%I
       for each row execute function public.block_disabled_feature(%L)',
      v_pair[1], v_pair[2]);
    execute format(
      'create policy "Only while the feature is on" on public.%I
       as restrictive for insert to authenticated
       with check (public.feature_enabled(%L) or public.is_admin())',
      v_pair[1], v_pair[2]);
  end loop;
end;
$$;

-- =============================================================================
-- Branding and the maintenance banner
-- =============================================================================

-- WCAG contrast. Relative luminance of a colour like '#0e6857' (0 = black, 1 = white).
create function public.hex_luminance(p_hex text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_channel numeric;
  v_linear numeric[] := '{}';
  i int;
begin
  for i in 0..2 loop
    v_channel := ('x' || substr(p_hex, 2 + i * 2, 2))::bit(8)::int / 255.0;
    v_linear := v_linear || case
      when v_channel <= 0.03928 then v_channel / 12.92
      else power((v_channel + 0.055) / 1.055, 2.4)
    end;
  end loop;
  return 0.2126 * v_linear[1] + 0.7152 * v_linear[2] + 0.0722 * v_linear[3];
end;
$$;

-- How readable white text is on a colour: 1 (invisible) to 21 (black).
create function public.contrast_with_white(p_hex text)
returns numeric
language sql
immutable
as $$
  select round(1.05 / (public.hex_luminance(p_hex) + 0.05), 2);
$$;

alter table public.app_settings
  add column logo_url text check (logo_url ~* '^https?://'),
  add column accent_color text not null default '#0e6857' check (accent_color ~* '^#[0-9a-f]{6}$'),
  add column maintenance_enabled boolean not null default false,
  add column maintenance_message text check (char_length(maintenance_message) <= 300),
  add column maintenance_until timestamptz;

-- Buttons and the tab bar put white text on the accent colour, so it must be
-- dark enough to read (4.5:1, WCAG AA). Explained, so the admin knows why.
create function public.app_settings_check_branding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrast numeric := public.contrast_with_white(new.accent_color);
begin
  new.accent_color := lower(new.accent_color);
  if v_contrast < 4.5 then
    raise exception 'White text on % has a contrast of only %:1; it needs at least 4.5:1 to be readable. Choose a darker colour.',
      new.accent_color, v_contrast;
  end if;
  if new.maintenance_enabled and nullif(trim(coalesce(new.maintenance_message, '')), '') is null then
    raise exception 'Write the maintenance message people will see.';
  end if;
  return new;
end;
$$;

create trigger app_settings_check_branding
before update on public.app_settings
for each row execute function public.app_settings_check_branding();

-- What every screen needs before anything else, including the sign-in screen
-- (so it's open to signed-out visitors too): the school's name, logo and
-- colour, and the maintenance message while one is on.
create function public.public_status()
returns table (
  school_name text,
  logo_url text,
  accent_color text,
  maintenance_message text,
  maintenance_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.school_name,
    s.logo_url,
    s.accent_color,
    case when s.maintenance_enabled and (s.maintenance_until is null or s.maintenance_until > now())
      then s.maintenance_message end,
    case when s.maintenance_enabled and (s.maintenance_until is null or s.maintenance_until > now())
      then s.maintenance_until end
  from public.app_settings s;
$$;

grant execute on function public.public_status() to anon, authenticated;

-- The logo: public (it's on the sign-in screen), images only, up to 1 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 1048576, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "Admins upload branding" on storage.objects for insert to authenticated
with check (bucket_id = 'branding' and public.is_admin());
create policy "Admins replace branding" on storage.objects for update to authenticated
using (bucket_id = 'branding' and public.is_admin());
create policy "Admins delete branding" on storage.objects for delete to authenticated
using (bucket_id = 'branding' and public.is_admin());

-- =============================================================================
-- Data export (CSV is made in the browser from these rows; admins only)
-- =============================================================================
create function public.admin_export_bookings(p_from date, p_to date)
returns table (
  venue text,
  title text,
  requested_by text,
  requester_role public.user_role,
  supervising_teacher text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.booking_status,
  reviewed_by text,
  review_note text,
  requested_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can export data.' using errcode = '42501';
  end if;
  return query
    select v.name, b.title, rq.full_name, rq.role, st.full_name, b.starts_at, b.ends_at, b.status,
           rv.full_name, b.review_note, b.created_at
    from public.bookings b
    join public.venues v on v.id = b.venue_id
    join public.profiles rq on rq.id = b.requester_id
    left join public.profiles st on st.id = b.supervising_teacher_id
    left join public.profiles rv on rv.id = b.reviewed_by
    where (b.starts_at at time zone 'Asia/Dubai')::date between p_from and p_to
    order by b.starts_at;
end;
$$;

create function public.admin_export_reports(p_from date, p_to date)
returns table (
  reported_at timestamptz,
  category text,
  room text,
  description text,
  status public.report_status,
  urgent boolean,
  me_too int,
  reported_by text,
  assigned_to text,
  resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can export data.' using errcode = '42501';
  end if;
  return query
    select r.created_at, coalesce(c.name, r.category), rm.code, r.description, r.status, r.urgent,
           (select count(*)::int from public.report_votes v where v.report_id = r.id),
           rp.full_name, asg.full_name, r.resolved_at
    from public.reports r
    left join public.report_categories c on c.key = r.category
    left join public.rooms rm on rm.id = r.room_id
    join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles asg on asg.id = r.assigned_to
    where (r.created_at at time zone 'Asia/Dubai')::date between p_from and p_to
    order by r.created_at;
end;
$$;

-- =============================================================================
-- Data deletion requests: anonymise a person
-- =============================================================================
alter table public.profiles add column anonymised_at timestamptz;

-- Admins may delete uploaded files in the private buckets (the person's own
-- photos and attachments), which the app does before anonymising.
create policy "Admins delete report photos" on storage.objects for delete to authenticated
using (bucket_id = 'report-photos' and public.is_admin());
create policy "Admins delete project files" on storage.objects for delete to authenticated
using (bucket_id = 'project-files' and public.is_admin());

-- The files someone uploaded: fix-it photos and project attachments.
create function public.admin_user_files(p_user_id uuid)
returns table (bucket text, path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see someone''s files.' using errcode = '42501';
  end if;
  return query
    select o.bucket_id, o.name
    from storage.objects o
    where (o.bucket_id = 'report-photos'
           and public.uuid_or_null((storage.foldername(o.name))[2]) in
               (select id from public.reports where reporter_id = p_user_id))
       or (o.bucket_id = 'project-files'
           and public.uuid_or_null((storage.foldername(o.name))[1]) in
               (select id from public.projects where owner_id = p_user_id));
end;
$$;

-- Replaces someone's name and email, removes their uploaded files, settings,
-- notifications and class memberships, and blocks their sign-in for good.
-- What they did stays, under "Deleted user": SUPW hours, reports, posts,
-- bookings. Needs their current email typed in full, as confirmation.
create function public.admin_anonymise_user(p_user_id uuid, p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_anon_email text := 'deleted-' || p_user_id || '@deleted.invalid';
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete someone''s data.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You can''t delete your own data. Ask another admin.';
  end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'That user doesn''t exist.';
  end if;
  if v_profile.anonymised_at is not null then
    raise exception 'This person''s data has already been deleted.';
  end if;
  if lower(trim(coalesce(p_confirm, ''))) <> lower(v_profile.email) then
    raise exception 'Type their email address exactly, to confirm.';
  end if;
  if v_profile.role = 'admin' and (select count(*) from public.profiles where role = 'admin' and anonymised_at is null) = 1 then
    raise exception 'You can''t remove the last admin.';
  end if;

  -- Files: the app removes them through the Storage API first, which deletes
  -- the files themselves. This tidies up any record left behind; newer
  -- Supabase versions refuse direct deletes here, which is fine, so a refusal
  -- is ignored rather than stopping the whole request.
  begin
    delete from storage.objects o
    using public.admin_user_files(p_user_id) f
    where o.bucket_id = f.bucket and o.name = f.path;
  exception when others then
    raise notice 'Storage records not removed here (%); the app removes the files first.', sqlerrm;
  end;
  update public.reports set photo_path = null where reporter_id = p_user_id;

  -- Personal settings and links.
  delete from public.notifications where recipient_id = p_user_id;
  delete from public.notification_prefs where user_id = p_user_id;
  delete from public.staff_email_prefs where user_id = p_user_id;
  delete from public.responsibilities where user_id = p_user_id;
  delete from public.class_teachers where teacher_id = p_user_id;
  delete from public.class_students where student_id = p_user_id;
  delete from public.staff_emails where lower(email) = lower(v_profile.email);
  delete from public.roster where lower(email) = lower(v_profile.email);

  update public.profiles
  set full_name = 'Deleted user',
      email = v_anon_email,
      avatar_initials = null,
      section = null,
      posting_suspended_until = null,
      suspension_reason = null,
      archived_at = coalesce(archived_at, now()),
      anonymised_at = now()
  where id = p_user_id;

  -- Sign-in: no email, no Google or Microsoft link, and banned for good.
  update auth.users
  set email = v_anon_email,
      raw_user_meta_data = '{}',
      banned_until = '2999-12-31'::timestamptz
  where id = p_user_id;
  delete from auth.identities where user_id = p_user_id;

  -- No name or email in the record: the log itself can't be edited later.
  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (auth.uid(), 'user_anonymised', 'profiles', p_user_id::text, '{}');
end;
$$;

-- =============================================================================
-- Audit log viewer
-- =============================================================================
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_table_idx on public.audit_log (table_name, created_at desc);

-- The choices for the viewer's filters: every action and table in the log.
create function public.admin_audit_filters()
returns table (kind text, value text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can read the audit log.' using errcode = '42501';
  end if;
  return query
    select distinct 'action', a.action from public.audit_log a
    union
    select distinct 'table', a.table_name from public.audit_log a
    order by 1, 2;
end;
$$;
