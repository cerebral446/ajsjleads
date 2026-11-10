-- =====================================================================
-- AJSJ Services LLC — Lead Tracker (Version 1)
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT where possible.
--
-- Structure overview
--   profiles          one row per app user (mirrors auth.users)
--   lead_statuses     editable list of pipeline statuses
--   lead_sources      editable list of lead sources
--   leads             companies / contacts being worked
--   follow_ups        scheduled follow-ups (one "open" per lead at a time)
--   activities        every call, note, status change, follow-up event
--
-- Future (not built in V1): sales / revenue analytics.
--   Add e.g. `opportunities (id, lead_id → leads, amount, stage, won_at…)`
--   and `invoices`. Everything here keys on leads.id, so those tables can
--   join cleanly without changing V1 tables.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  role        text not null default 'member',   -- 'admin' | 'member' (for later)
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any users that existed before this script ran
insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Lookup tables (editable later — add/rename/reorder rows, no code change)
-- color: one of blue, slate, gray, cyan, amber, emerald, violet,
--        orange, teal, green, stone, red  (see src/components/StatusBadge.tsx)
-- is_terminal: lead is closed out (excluded from "New Leads" count)
-- ---------------------------------------------------------------------
create table if not exists public.lead_statuses (
  key         text primary key,
  label       text not null,
  color       text not null default 'slate',
  sort_order  int  not null default 0,
  is_terminal boolean not null default false,
  is_active   boolean not null default true
);

insert into public.lead_statuses (key, label, color, sort_order, is_terminal) values
  ('new_lead',          'New Lead',                'blue',    10,  false),
  ('attempted_contact', 'Attempted Contact',       'slate',   20,  false),
  ('no_answer',         'No Answer',               'gray',    30,  false),
  ('contacted',         'Contacted',               'cyan',    40,  false),
  ('follow_up_needed',  'Follow-Up Needed',        'amber',   50,  false),
  ('interested',        'Interested',              'emerald', 60,  false),
  ('send_information',  'Send Information',        'violet',  70,  false),
  ('bid_requested',     'Bid / Pricing Requested', 'orange',  80,  false),
  ('onboarding',        'Onboarding',              'teal',    90,  false),
  ('active_customer',   'Active Customer',         'green',   100, false),
  ('not_interested',    'Not Interested',          'stone',   110, true),
  ('do_not_contact',    'Do Not Contact',          'red',     120, true)
on conflict (key) do nothing;

create table if not exists public.lead_sources (
  key         text primary key,
  label       text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true
);

insert into public.lead_sources (key, label, sort_order) values
  ('cold_call',             'Cold Call',             10),
  ('google',                'Google',                20),
  ('facebook',              'Facebook',              30),
  ('instagram',             'Instagram',             40),
  ('linkedin',              'LinkedIn',              50),
  ('referral',              'Referral',              60),
  ('website',               'Website',               70),
  ('existing_relationship', 'Existing Relationship', 80),
  ('other',                 'Other',                 90)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id                 uuid primary key default gen_random_uuid(),
  company_name       text,
  contact_name       text,
  job_title          text,
  phone              text,
  phone_digits       text generated always as (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) stored,
  email              text,
  website            text,
  location           text,
  source             text references public.lead_sources (key) on update cascade on delete set null,
  status             text not null default 'new_lead'
                       references public.lead_statuses (key) on update cascade,
  notes              text,

  last_contacted_at  timestamptz,
  last_outcome       text,          -- outcome key of the most recent call
  last_note          text,          -- notes from the most recent call
  next_follow_up_at  timestamptz,   -- kept in sync from follow_ups by trigger

  assigned_to        uuid references public.profiles (id) on delete set null,
  created_by         uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by         uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint leads_has_name check (coalesce(company_name, contact_name) is not null)
);

create index if not exists leads_next_follow_up_idx on public.leads (next_follow_up_at);
create index if not exists leads_status_idx        on public.leads (status);
create index if not exists leads_created_at_idx    on public.leads (created_at desc);
create index if not exists leads_last_contacted_idx on public.leads (last_contacted_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists leads_touch_updated_at on public.leads;
create trigger leads_touch_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Activities (the timeline)
-- type: 'created' | 'call' | 'note' | 'follow_up' | 'follow_up_done'
--       | 'follow_up_cleared' | 'status_change'
-- ---------------------------------------------------------------------
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  type        text not null,
  outcome     text,
  notes       text,
  metadata    jsonb not null default '{}'::jsonb,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists activities_lead_idx    on public.activities (lead_id, created_at desc);
create index if not exists activities_created_idx on public.activities (created_at desc);

create or replace function public.log_lead_created()
returns trigger language plpgsql as $$
begin
  insert into public.activities (lead_id, type, metadata, created_by)
  values (new.id, 'created', jsonb_build_object('status', new.status), new.created_by);
  return new;
end;
$$;

drop trigger if exists leads_log_created on public.leads;
create trigger leads_log_created
  after insert on public.leads
  for each row execute function public.log_lead_created();

-- ---------------------------------------------------------------------
-- Follow-ups
-- ---------------------------------------------------------------------
create table if not exists public.follow_ups (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads (id) on delete cascade,
  due_at        timestamptz not null,
  note          text,
  status        text not null default 'open',  -- 'open' | 'done' | 'canceled'
  assigned_to   uuid references public.profiles (id) on delete set null,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  completed_by  uuid references public.profiles (id) on delete set null
);

create index if not exists follow_ups_open_idx on public.follow_ups (lead_id) where status = 'open';
create index if not exists follow_ups_due_idx  on public.follow_ups (due_at);

-- Keep leads.next_follow_up_at = earliest open follow-up
create or replace function public.sync_next_follow_up()
returns trigger language plpgsql as $$
declare v_lead uuid := coalesce(new.lead_id, old.lead_id);
begin
  update public.leads
     set next_follow_up_at = (
       select min(due_at) from public.follow_ups
        where lead_id = v_lead and status = 'open')
   where id = v_lead;
  return null;
end;
$$;

drop trigger if exists follow_ups_sync on public.follow_ups;
create trigger follow_ups_sync
  after insert or update or delete on public.follow_ups
  for each row execute function public.sync_next_follow_up();

-- ---------------------------------------------------------------------
-- RPC: log a call (one transaction)
--   • completes follow-ups due before end of today
--   • if a next follow-up is given, replaces any other open follow-up
--   • updates last contacted / last outcome / optional status
--   • writes the timeline entry
-- ---------------------------------------------------------------------
create or replace function public.log_call(
  p_lead_id      uuid,
  p_outcome      text,
  p_notes        text,
  p_follow_up_at timestamptz,
  p_new_status   text,
  p_day_end      timestamptz
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_uid        uuid := auth.uid();
  v_old_status text;
  v_assigned   uuid;
  v_new_status text := nullif(p_new_status, '');
  v_notes      text := nullif(trim(coalesce(p_notes, '')), '');
  v_activity   uuid;
begin
  select status, assigned_to into v_old_status, v_assigned
    from public.leads where id = p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;

  if v_new_status = v_old_status then v_new_status := null; end if;

  update public.follow_ups
     set status = 'done', completed_at = now(), completed_by = v_uid
   where lead_id = p_lead_id and status = 'open' and due_at < p_day_end;

  if p_follow_up_at is not null then
    update public.follow_ups
       set status = 'canceled', completed_at = now(), completed_by = v_uid
     where lead_id = p_lead_id and status = 'open';
    insert into public.follow_ups (lead_id, due_at, assigned_to, created_by)
    values (p_lead_id, p_follow_up_at, coalesce(v_assigned, v_uid), v_uid);
  end if;

  update public.leads
     set last_contacted_at = now(),
         last_outcome      = p_outcome,
         last_note         = v_notes,
         status            = coalesce(v_new_status, status)
   where id = p_lead_id;

  insert into public.activities (lead_id, type, outcome, notes, metadata, created_by)
  values (
    p_lead_id, 'call', p_outcome, v_notes,
    jsonb_strip_nulls(jsonb_build_object(
      'follow_up_at', p_follow_up_at,
      'status_from',  case when v_new_status is not null then v_old_status end,
      'status_to',    v_new_status
    )),
    v_uid
  ) returning id into v_activity;

  return v_activity;
end;
$$;

-- RPC: schedule (or reschedule) the next follow-up
create or replace function public.schedule_follow_up(
  p_lead_id uuid,
  p_due_at  timestamptz,
  p_note    text
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_uid uuid := auth.uid();
  v_assigned uuid;
  v_id uuid;
begin
  select assigned_to into v_assigned from public.leads where id = p_lead_id;
  if not found then raise exception 'Lead not found'; end if;

  update public.follow_ups
     set status = 'canceled', completed_at = now(), completed_by = v_uid
   where lead_id = p_lead_id and status = 'open';

  insert into public.follow_ups (lead_id, due_at, note, assigned_to, created_by)
  values (p_lead_id, p_due_at, nullif(trim(coalesce(p_note, '')), ''), coalesce(v_assigned, v_uid), v_uid)
  returning id into v_id;

  insert into public.activities (lead_id, type, notes, metadata, created_by)
  values (p_lead_id, 'follow_up', nullif(trim(coalesce(p_note, '')), ''),
          jsonb_build_object('follow_up_at', p_due_at), v_uid);

  return v_id;
end;
$$;

-- RPC: close open follow-ups without logging a call
--   p_status: 'done' (mark done) or 'canceled' (clear)
create or replace function public.close_follow_ups(
  p_lead_id uuid,
  p_status  text
) returns void
language plpgsql
security invoker
as $$
declare v_uid uuid := auth.uid(); v_count int;
begin
  if p_status not in ('done', 'canceled') then raise exception 'Invalid status'; end if;

  update public.follow_ups
     set status = p_status, completed_at = now(), completed_by = v_uid
   where lead_id = p_lead_id and status = 'open';
  get diagnostics v_count = row_count;

  if v_count > 0 then
    insert into public.activities (lead_id, type, created_by)
    values (p_lead_id, case when p_status = 'done' then 'follow_up_done' else 'follow_up_cleared' end, v_uid);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- V1: a single shared team — every signed-in user can see and work all
-- leads. Turn OFF public sign-ups in Supabase (see README) so only people
-- you invite can sign in.
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.lead_statuses enable row level security;
alter table public.lead_sources  enable row level security;
alter table public.leads         enable row level security;
alter table public.activities    enable row level security;
alter table public.follow_ups    enable row level security;

drop policy if exists "profiles read"       on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles read"       on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "statuses read" on public.lead_statuses;
create policy "statuses read" on public.lead_statuses for select to authenticated using (true);

drop policy if exists "sources read" on public.lead_sources;
create policy "sources read" on public.lead_sources for select to authenticated using (true);

drop policy if exists "team leads"      on public.leads;
drop policy if exists "team activities" on public.activities;
drop policy if exists "team follow_ups" on public.follow_ups;
create policy "team leads"      on public.leads      for all to authenticated using (true) with check (true);
create policy "team activities" on public.activities for all to authenticated using (true) with check (true);
create policy "team follow_ups" on public.follow_ups for all to authenticated using (true) with check (true);

grant execute on function public.log_call(uuid, text, text, timestamptz, text, timestamptz) to authenticated;
grant execute on function public.schedule_follow_up(uuid, timestamptz, text) to authenticated;
grant execute on function public.close_follow_ups(uuid, text) to authenticated;
